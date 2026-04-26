#!/usr/bin/env python3
import time
import json
import random
import argparse
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any

try:
    from tqdm import tqdm
except ImportError:
    print("Please install tqdm: pip install tqdm requests")
    exit(1)

# Configuration
API_ENDPOINT = "http://localhost:8000/api/v1/logs/ingest"
SIM_SESSION_DIR = Path("data/sim_sessions")
SIM_SESSION_DIR.mkdir(parents=True, exist_ok=True)

class NormalTrafficGenerator:
    """Generates realistic normal network traffic."""
    def __init__(self, ip_pool_size: int = 50):
        self.ip_pool = [f"192.168.1.{i}" for i in range(10, 10 + ip_pool_size)]
        self.common_ports = [80, 443, 53, 123]
        self.protocols = ["TCP", "UDP"]
        
    def generate_log(self, current_time: str) -> Dict[str, Any]:
        """Generates a single normal log entry."""
        protocol = random.choices(self.protocols, weights=[0.8, 0.2])[0]
        port = random.choices(self.common_ports, weights=[0.3, 0.6, 0.05, 0.05])[0]
        
        return {
            "source_ip": random.choice(self.ip_pool),
            "dest_ip": f"10.0.0.{random.randint(1, 20)}",
            "dest_port": port,
            "protocol": protocol,
            "bytes_sent": random.randint(100, 5000),
            "bytes_received": random.randint(500, 20000),
            "duration_seconds": round(random.uniform(0.1, 5.0), 3),
            "timestamp": current_time
        }

class AttackScenarioGenerator:
    """Generates specific attack patterns."""
    
    @staticmethod
    def generate_brute_force(attacker_ip: str, intensity: int, current_time: str) -> List[Dict]:
        """High-frequency identical requests to secure ports (22, 443)."""
        logs = []
        for _ in range(intensity):
            logs.append({
                "source_ip": attacker_ip,
                "dest_ip": "10.0.0.5",
                "dest_port": random.choice([22, 443]),
                "protocol": "TCP",
                "bytes_sent": random.randint(40, 60),  # Small auth payloads
                "bytes_received": random.randint(40, 100),
                "duration_seconds": round(random.uniform(0.01, 0.05), 3),
                "timestamp": current_time
            })
        return logs

    @staticmethod
    def generate_ddos(base_ip: str, n_sources: int, intensity: int, current_time: str) -> List[Dict]:
        """High volume from multiple IPs."""
        logs = []
        for i in range(n_sources):
            source_ip = f"{base_ip}.{i}"
            for _ in range(intensity // n_sources):
                logs.append({
                    "source_ip": source_ip,
                    "dest_ip": "10.0.0.1",
                    "dest_port": 80,
                    "protocol": "TCP",
                    "bytes_sent": 1000,
                    "bytes_received": 0,
                    "duration_seconds": 0.01,
                    "timestamp": current_time
                })
        return logs

    @staticmethod
    def generate_port_scan(attacker_ip: str, current_time: str) -> List[Dict]:
        """Sequential connections across many ports."""
        logs = []
        # Simulate scanning 20 sequential ports per tick
        start_port = random.randint(1, 1000)
        for p in range(start_port, start_port + 20):
            logs.append({
                "source_ip": attacker_ip,
                "dest_ip": "10.0.0.10",
                "dest_port": p,
                "protocol": "TCP",
                "bytes_sent": 0,
                "bytes_received": 0,
                "duration_seconds": 0.001,
                "timestamp": current_time
            })
        return logs

class SimulationRunner:
    def __init__(self, mode: str, duration: int, attack_ratio: float, attack_type: str = None):
        self.mode = mode
        self.duration = duration
        self.attack_ratio = attack_ratio
        self.attack_type = attack_type
        self.normal_gen = NormalTrafficGenerator()
        self.session_data = []

    def _send_batch(self, logs: List[Dict]):
        """Send a batch of logs to the API."""
        if not logs: return
        
        try:
            # We assume the endpoint accepts a list of logs
            response = requests.post(API_ENDPOINT, json=logs, timeout=2.0)
            if response.status_code not in (200, 201, 202):
                pass # Optionally log failures
        except requests.exceptions.RequestException:
            pass # Ignore API unreachability for robustness during demo

    def run(self):
        print(f"\n[+] Starting TARS Traffic Simulator")
        print(f"    Mode: {self.mode}")
        print(f"    Duration: {self.duration} seconds")
        if self.mode != "normal":
            print(f"    Attack Type: {self.attack_type or 'Mixed'}")
            
        session_file = SIM_SESSION_DIR / f"sim_{int(time.time())}.json"
        
        # Attack state tracking
        attacker_ip = f"185.15.54.{random.randint(10, 250)}"
        
        with tqdm(total=self.duration, desc="Simulating Traffic", unit="sec") as pbar:
            for sec in range(self.duration):
                current_time = datetime.now(timezone.utc).isoformat()
                logs_batch = []
                
                # Generate Normal Traffic (approx 20-50 req/sec)
                if self.mode in ["normal", "mixed"]:
                    normal_reqs = random.randint(20, 50)
                    for _ in range(normal_reqs):
                        logs_batch.append(self.normal_gen.generate_log(current_time))
                
                # Generate Attack Traffic
                if self.mode == "attack-only" or (self.mode == "mixed" and random.random() < self.attack_ratio):
                    a_type = self.attack_type
                    if self.mode == "mixed" and not a_type:
                        a_type = random.choice(["brute_force", "port_scan", "ddos"])
                        
                    if a_type == "brute_force":
                        logs_batch.extend(AttackScenarioGenerator.generate_brute_force(attacker_ip, intensity=60, current_time=current_time))
                    elif a_type == "port_scan":
                        logs_batch.extend(AttackScenarioGenerator.generate_port_scan(attacker_ip, current_time=current_time))
                    elif a_type == "ddos":
                        logs_batch.extend(AttackScenarioGenerator.generate_ddos("203.0.113", n_sources=15, intensity=150, current_time=current_time))
                
                self.session_data.extend(logs_batch)
                
                # Send to API in chunks to avoid overloading network buffers
                chunk_size = 100
                for i in range(0, len(logs_batch), chunk_size):
                    self._send_batch(logs_batch[i:i + chunk_size])
                
                pbar.update(1)
                time.sleep(1) # Real-time simulation
                
        # Save session
        with open(session_file, 'w') as f:
            json.dump(self.session_data, f)
            
        print(f"\n[+] Simulation complete. Generated {len(self.session_data)} logs.")
        print(f"    Session saved to: {session_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TARS Traffic Simulator")
    parser.add_argument("--mode", type=str, choices=["normal", "mixed", "attack-only"], default="mixed", help="Traffic simulation mode")
    parser.add_argument("--duration", type=int, default=300, help="Duration in seconds")
    parser.add_argument("--attack-ratio", type=float, default=0.1, help="Probability of attack per second (for mixed mode)")
    parser.add_argument("--attack-type", type=str, choices=["brute_force", "ddos", "port_scan"], help="Specific attack type to force")
    
    args = parser.parse_args()
    
    runner = SimulationRunner(
        mode=args.mode,
        duration=args.duration,
        attack_ratio=args.attack_ratio,
        attack_type=args.attack_type
    )
    runner.run()
