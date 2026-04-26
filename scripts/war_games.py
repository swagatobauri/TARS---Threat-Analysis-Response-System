#!/usr/bin/env python3
import asyncio
import aiohttp
import json
import logging
import random
import time
import argparse
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import List, Dict, Set

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("WarGames")

class KillChainStage:
    RECON = "RECONNAISSANCE"
    ENUM = "ENUMERATION"
    EXPLOIT = "EXPLOITATION"
    PERSIST = "PERSISTENCE"

@dataclass
class WarGamesReport:
    strategies_tried: List[str]
    detected_count: int
    evaded_count: int
    avg_detection_time_s: float
    false_positive_count: int
    results_table: List[dict]

class AdversarialAttacker:
    def __init__(self, initial_strategy: str, target_api: str = "http://localhost:8000"):
        self.current_strategy = initial_strategy
        self.target_api = target_api.rstrip("/")
        self.blocked_ips: Set[str] = set()
        self.rate_limited_ips: Set[str] = set()
        self.current_stage = KillChainStage.RECON
        self.attack_count = 0
        
        self.session = None
        self.running = False
        
        self.active_ips = [self._random_ip() for _ in range(100)]
        self.current_ip_index = 0
        self.strategy_start_time = time.time()
        self.detection_times = []
        
        self.strategies_tried = [initial_strategy]

    def _random_ip(self) -> str:
        return f"{random.randint(100, 200)}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"

    def adapt_strategy(self):
        old_strategy = self.current_strategy
        if old_strategy == "brute_force":
            self.current_strategy = "slow_burn"
        elif old_strategy == "slow_burn":
            self.current_strategy = "ip_rotation"
        elif old_strategy == "ip_rotation":
            self.current_strategy = "distributed_ddos"
        elif old_strategy == "distributed_ddos":
            self.current_strategy = "multi_vector"
        else:
            logger.info("ATTACKER: Out of strategies. Restarting cycle with multi_vector.")
            self.current_strategy = "multi_vector"
            
        self.strategies_tried.append(self.current_strategy)
        self.strategy_start_time = time.time()
        logger.warning(f"ATTACKER: blocked at {old_strategy} -> switching to {self.current_strategy}")

    async def _send_log(self, log_entry: dict):
        if not self.session:
            return
        
        # Add required defaults
        payload = {
            "source_ip": log_entry.get("source_ip", self.active_ips[0]),
            "dest_ip": "10.0.0.1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_rate": log_entry.get("request_rate", 5.0),
            "raw_payload": log_entry.get("raw_payload", {}),
            "dest_port": log_entry.get("dest_port", 80),
            "protocol": "TCP"
        }
        
        try:
            async with self.session.post(f"{self.target_api}/api/v1/logs/ingest", json=[payload]) as resp:
                await resp.json()
                self.attack_count += 1
        except Exception as e:
            pass # Ignore connection errors during rapid fire

    async def check_blocks(self):
        """Poll /api/v1/threats to see if our active IPs have been blocked."""
        if not self.session:
            return 0.0
            
        try:
            async with self.session.get(f"{self.target_api}/api/v1/threats?limit=50") as resp:
                if resp.status == 200:
                    threats = await resp.json()
                    blocked_this_cycle = 0
                    
                    for t in threats:
                        if t["source_ip"] in self.active_ips and t["action_taken"] in ["BLOCK", "RATE_LIMIT"]:
                            if t["source_ip"] not in self.blocked_ips:
                                self.blocked_ips.add(t["source_ip"])
                                blocked_this_cycle += 1
                                
                                # Record detection time
                                dt = time.time() - self.strategy_start_time
                                self.detection_times.append(dt)
                                logger.info(f"DETECTED: IP {t['source_ip']} was {t['action_taken']} in {dt:.1f}s")
                    
                    return blocked_this_cycle / max(1, len(self.active_ips))
        except Exception as e:
            pass
        return 0.0

    # -- Strategies --

    async def brute_force(self):
        ip = self.active_ips[0]
        for _ in range(10):
            await self._send_log({
                "source_ip": ip,
                "request_rate": 200.0,
                "raw_payload": {"failed_logins": random.randint(10, 50)}
            })
            await asyncio.sleep(0.5)

    async def slow_burn(self):
        ip = self.active_ips[1]
        for _ in range(3):
            await self._send_log({
                "source_ip": ip,
                "request_rate": 3.0, # Evades rate-based
                "raw_payload": {"endpoint_probing": True}
            })
            await asyncio.sleep(5)

    async def ip_rotation(self):
        pool = self.active_ips[2:52]
        ip = pool[self.current_ip_index % len(pool)]
        
        for _ in range(5):
            await self._send_log({
                "source_ip": ip,
                "request_rate": 15.0,
                "raw_payload": {"sqli_pattern": "1=1"}
            })
            await asyncio.sleep(1)
            
        self.current_ip_index += 1

    async def distributed_ddos(self):
        pool = self.active_ips[52:]
        tasks = []
        for ip in random.sample(pool, min(10, len(pool))):
            tasks.append(self._send_log({
                "source_ip": ip,
                "request_rate": 50.0,
                "raw_payload": {"connection_flood": True}
            }))
        await asyncio.gather(*tasks)
        await asyncio.sleep(2) # rest

    async def multi_vector(self):
        ip = self.active_ips[0]
        # RECON
        self.current_stage = KillChainStage.RECON
        await self._send_log({"source_ip": ip, "request_rate": 100.0, "raw_payload": {"port_entropy": 0.9}})
        await asyncio.sleep(2)
        # ENUM
        self.current_stage = KillChainStage.ENUM
        await self._send_log({"source_ip": ip, "request_rate": 40.0, "raw_payload": {"dirbuster": True}})
        await asyncio.sleep(2)
        # EXPLOIT
        self.current_stage = KillChainStage.EXPLOIT
        await self._send_log({"source_ip": ip, "request_rate": 5.0, "raw_payload": {"sqli_pattern": "admin' --"}})
        await asyncio.sleep(2)

    async def run_attack_cycle(self):
        while self.running:
            start_time = time.time()
            
            # Execute current strategy for roughly 10 seconds per loop
            while time.time() - start_time < 10:
                if self.current_strategy == "brute_force":
                    await self.brute_force()
                elif self.current_strategy == "slow_burn":
                    await self.slow_burn()
                elif self.current_strategy == "ip_rotation":
                    await self.ip_rotation()
                elif self.current_strategy == "distributed_ddos":
                    await self.distributed_ddos()
                elif self.current_strategy == "multi_vector":
                    await self.multi_vector()
                elif self.current_strategy == "adaptive":
                    # Adaptive starts at brute force
                    self.current_strategy = "brute_force"
                    await self.brute_force()
                
            block_rate = await self.check_blocks()
            
            if block_rate > 0.20 or (self.current_strategy == "brute_force" and block_rate > 0.05):
                self.adapt_strategy()
                
            await asyncio.sleep(2)


class WarGamesRunner:
    def __init__(self, target_api: str = "http://localhost:8000"):
        self.target_api = target_api
        self.session = None

    async def generate_background_traffic(self):
        while self.session:
            payload = {
                "source_ip": f"192.168.1.{random.randint(10, 250)}",
                "dest_ip": "10.0.0.1",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_rate": random.uniform(1.0, 10.0),
                "dest_port": 443,
                "protocol": "TCP",
                "bytes_sent": random.randint(500, 5000),
                "duration_seconds": random.uniform(0.1, 2.0)
            }
            try:
                await self.session.post(f"{self.target_api}/api/v1/logs/ingest", json=[payload])
            except:
                pass
            await asyncio.sleep(0.5)

    async def run(self, duration_minutes: int = 30, strategy: str = "adaptive") -> WarGamesReport:
        logger.info(f"Starting War Games Simulation for {duration_minutes} minutes. Mode: {strategy}")
        
        attacker = AdversarialAttacker(strategy, self.target_api)
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            attacker.session = session
            attacker.running = True
            
            bg_task = asyncio.create_task(self.generate_background_traffic())
            attack_task = asyncio.create_task(attacker.run_attack_cycle())
            
            try:
                await asyncio.sleep(duration_minutes * 60)
            except KeyboardInterrupt:
                logger.info("Simulation interrupted manually.")
            finally:
                self.session = None
                attacker.running = False
                bg_task.cancel()
                attack_task.cancel()
        
        avg_dt = sum(attacker.detection_times) / len(attacker.detection_times) if attacker.detection_times else 0.0
        
        report = WarGamesReport(
            strategies_tried=attacker.strategies_tried,
            detected_count=len(attacker.blocked_ips),
            evaded_count=attacker.attack_count - len(attacker.blocked_ips), # simplified
            avg_detection_time_s=avg_dt,
            false_positive_count=0, # Need actual endpoint check to populate
            results_table=[
                {"strategy": s, "avg_time": avg_dt} for s in attacker.strategies_tried
            ]
        )
        
        return report

async def main():
    parser = argparse.ArgumentParser(description="TARS War Games Adversarial Simulation")
    parser.add_argument("--duration", type=int, default=30, help="Duration in minutes")
    parser.add_argument("--strategy", type=str, default="adaptive", choices=["adaptive", "brute_force", "slow_burn", "ip_rotation", "distributed_ddos", "multi_vector"])
    parser.add_argument("--report", action="store_true", help="Print detailed report at end")
    parser.add_argument("--api", type=str, default="http://localhost:8000", help="TARS API URL")
    
    args = parser.parse_args()
    
    runner = WarGamesRunner(target_api=args.api)
    report = await runner.run(duration_minutes=args.duration, strategy=args.strategy)
    
    if args.report:
        print("\n" + "="*50)
        print(" TARS WAR GAMES REPORT ")
        print("="*50)
        print(f"Strategies Executed: {', '.join(report.strategies_tried)}")
        print(f"Total Blocked Attacker IPs: {report.detected_count}")
        print(f"Avg Detection Time: {report.avg_detection_time_s:.2f} seconds")
        print("="*50)

if __name__ == "__main__":
    asyncio.run(main())
