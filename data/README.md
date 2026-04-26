# TARS — Dataset Directory

This directory holds cybersecurity datasets used for training TARS ML models and running live simulations.

> **These datasets are NOT included in the repository due to their size. You must download them manually.**

---

## 1. CICIDS2017 (Canadian Institute for Cybersecurity)

**Download:** https://www.unb.ca/cic/datasets/ids-2017.html  
**Mirror:** https://www.kaggle.com/datasets/ciaborheydarmoein/cicids2017  
**Size:** ~6.4 GB (all CSV files)

### Expected structure:
```
data/cicids2017/
├── Monday-WorkingHours.pcap_ISCX.csv
├── Tuesday-WorkingHours.pcap_ISCX.csv
├── Wednesday-workingHours.pcap_ISCX.csv
├── Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv
├── Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv
├── Friday-WorkingHours-Morning.pcap_ISCX.csv
├── Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv
└── Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv
```

### Attack types included:
- Brute Force (SSH, FTP)
- DDoS
- Web Attacks (XSS, SQL Injection)
- Infiltration
- Port Scan
- Botnet (Ares)

---

## 2. UNSW-NB15 (Australian Centre for Cyber Security)

**Download:** https://research.unsw.edu.au/projects/unsw-nb15-dataset  
**Mirror:** https://www.kaggle.com/datasets/mrwellsdavid/unsw-nb15  
**Size:** ~1.8 GB

### Expected structure:
```
data/unsw-nb15/
├── UNSW_NB15_training-set.csv
├── UNSW_NB15_testing-set.csv
├── UNSW-NB15_1.csv     (optional, raw split)
├── UNSW-NB15_2.csv
├── UNSW-NB15_3.csv
└── UNSW-NB15_4.csv
```

### Attack types included:
- Fuzzers, Analysis, Backdoor, DoS
- Exploits, Generic, Reconnaissance
- Shellcode, Worms

---

## Usage

```bash
# Train ML models on CICIDS2017 (50k balanced sample)
python scripts/dataset_loader.py --dataset cicids --mode train --sample 50000

# Feed UNSW data into live system for simulation
python scripts/dataset_loader.py --dataset unsw --mode simulate --n 500
```
