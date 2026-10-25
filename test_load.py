#!/usr/bin/env python3
"""
Load Testing Suite for When Am I UpDog? (Google Sheets GViz Endpoint)
Simulates concurrent users requesting canonical event sheets and master schedule.
"""

import argparse
import concurrent.futures
import statistics
import time
import urllib.error
import urllib.request

# Default Test Spreadsheet ID (User Copy)
DEFAULT_SHEET_ID = "1CUyat3PuS_3W-DOmRHZqS57sYhq9d4ZeGPxUAjnlhnM"

# 14 Sheets requested per client (1 master grid + 13 canonical event sheets)
GIDS = [
    ("Master Grid", "1990171013"),
    ("Far Out", "0"),
    ("Fireball", "306313736"),
    ("Boom", "919833849"),
    ("FS Performance", "1789212166"),
    ("TimeWarp", "698159220"),
    ("7Up", "1717217507"),
    ("Spaced Out", "1732980814"),
    ("FS Criterion", "1374816905"),
    ("Four Way Play", "159025477"),
    ("FunKey", "1289351842"),
    ("Throw N Go", "1968227423"),
    ("Frizgility", "2097815225"),
    ("Greedy", "291836125"),
]


def fetch_sheet_tab(sheet_id: str, gid_name: str, gid: str, client_id: int, timeout: float = 12.0):
    """Fetches a single sheet tab with cache-busting timestamp mimicking browser client."""
    t0 = time.time()
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?gid={gid}&tqx=responseHandler:callback&_t={time.time()}_{client_id}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "*/*",
            "Referer": "https://wingmar.github.io/when-am-i-updog/",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = resp.getcode()
            body = resp.read()
            latency = (time.time() - t0) * 1000.0  # ms
            return {
                "client_id": client_id,
                "tab": gid_name,
                "gid": gid,
                "code": code,
                "latency_ms": latency,
                "bytes": len(body),
                "error": None,
            }
    except urllib.error.HTTPError as e:
        latency = (time.time() - t0) * 1000.0
        err_body = ""
        try:
            err_body = e.read()[:200].decode("utf-8", errors="ignore")
        except Exception:
            pass
        return {
            "client_id": client_id,
            "tab": gid_name,
            "gid": gid,
            "code": e.code,
            "latency_ms": latency,
            "bytes": 0,
            "error": f"HTTP {e.code}: {err_body}",
        }
    except Exception as e:
        latency = (time.time() - t0) * 1000.0
        return {
            "client_id": client_id,
            "tab": gid_name,
            "gid": gid,
            "code": 0,
            "latency_ms": latency,
            "bytes": 0,
            "error": str(e),
        }


def run_tier(sheet_id: str, num_users: int, max_workers: int = None):
    """Executes a burst test simulating `num_users` opening the app concurrently."""
    total_requests = num_users * len(GIDS)
    if max_workers is None:
        max_workers = min(total_requests, 120)

    print(f"\n==================================================================")
    print(f"  RUNNING TIER: {num_users} Simulated Users ({total_requests} Concurrent Requests)")
    print(f"  Workers: {max_workers} threads | Target Sheet: {sheet_id}")
    print(f"==================================================================")

    tasks = []
    for user_idx in range(num_users):
        for gid_name, gid in GIDS:
            tasks.append((user_idx + 1, gid_name, gid))

    start_time = time.time()
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(fetch_sheet_tab, sheet_id, gid_name, gid, client_id)
            for client_id, gid_name, gid in tasks
        ]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    duration = time.time() - start_time
    print_tier_report(num_users, total_requests, duration, results)
    return results


def print_tier_report(num_users: int, total_reqs: int, duration: float, results: list):
    """Prints a structured performance report."""
    status_counts = {}
    latencies = [r["latency_ms"] for r in results]
    errors = [r for r in results if r["code"] != 200]

    for r in results:
        code = r["code"]
        status_counts[code] = status_counts.get(code, 0) + 1

    success_count = status_counts.get(200, 0)
    success_rate = (success_count / total_reqs) * 100.0 if total_reqs else 0.0

    latencies.sort()
    min_lat = min(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    p50_lat = statistics.median(latencies) if latencies else 0
    p90_lat = latencies[int(len(latencies) * 0.90)] if latencies else 0
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0
    avg_lat = statistics.mean(latencies) if latencies else 0
    rps = total_reqs / duration if duration > 0 else 0

    print("\n--- RESULTS SUMMARY ---")
    print(f"  Total Requests:     {total_reqs} (14 per user)")
    print(f"  Wall Time:          {duration:.2f} seconds")
    print(f"  Throughput:         {rps:.1f} requests/sec")
    print(f"  Success Rate:       {success_rate:.1f}% ({success_count}/{total_reqs} OK)")

    print("\n--- HTTP STATUS CODES ---")
    for code, count in sorted(status_counts.items()):
        status_label = "OK" if code == 200 else ("Too Many Requests (429)" if code == 429 else f"Error ({code})")
        print(f"  HTTP {code} ({status_label}): {count} ({count/total_reqs*100:.1f}%)")

    print("\n--- LATENCY (RESPONSE TIME) ---")
    print(f"  Min:     {min_lat:7.1f} ms")
    print(f"  Average: {avg_lat:7.1f} ms")
    print(f"  p50:     {p50_lat:7.1f} ms")
    print(f"  p90:     {p90_lat:7.1f} ms")
    print(f"  p95:     {p95_lat:7.1f} ms")
    print(f"  Max:     {max_lat:7.1f} ms")

    if errors:
        print("\n--- DETECTED ERRORS (Sample) ---")
        for err in errors[:5]:
            print(f"  User #{err['client_id']} [{err['tab']}]: {err['error']}")
    else:
        print("\n  >>> No errors or 429 throttling detected! <<<")


def run_sustained_test(sheet_id: str, users_per_minute: int = 20, duration_seconds: int = 30):
    """Simulates ongoing polling by staggered users over a sustained time window."""
    print(f"\n==================================================================")
    print(f"  RUNNING SUSTAINED LOAD: ~{users_per_minute} users/min over {duration_seconds}s")
    print(f"  Target Sheet: {sheet_id}")
    print(f"==================================================================")

    interval = 60.0 / users_per_minute
    end_time = time.time() + duration_seconds
    client_counter = 0
    all_results = []
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        active_futures = []
        while time.time() < end_time:
            client_counter += 1
            # Fire all 14 tabs for this client
            for gid_name, gid in GIDS:
                active_futures.append(
                    executor.submit(fetch_sheet_tab, sheet_id, gid_name, gid, client_counter)
                )
            time.sleep(interval)

        for f in concurrent.futures.as_completed(active_futures):
            all_results.append(f.result())

    wall_duration = time.time() - start_time
    print_tier_report(client_counter, len(all_results), wall_duration, all_results)
    return all_results


def main():
    parser = argparse.ArgumentParser(description="Load Test Suite for When Am I UpDog?")
    parser.add_argument("--sheet-id", default=DEFAULT_SHEET_ID, help="Google Spreadsheet ID to test")
    parser.add_argument("--users", type=int, help="Run a specific tier with N simulated users")
    parser.add_argument("--sustained", action="store_true", help="Run sustained polling test")
    parser.add_argument("--all", action="store_true", help="Run all stepped tiers (1, 10, 25, 50 users)")

    args = parser.parse_args()

    if args.users:
        run_tier(args.sheet_id, args.users)
    elif args.sustained:
        run_sustained_test(args.sheet_id, users_per_minute=25, duration_seconds=30)
    elif args.all:
        for u in [1, 10, 25, 50]:
            run_tier(args.sheet_id, u)
            time.sleep(2)  # Cooldown between tiers
    else:
        # Default run: Baseline (1), Moderate (10), Peak (25), Stress (50)
        print("Running comprehensive load test suite across 4 tiers...")
        for u in [1, 10, 25, 50]:
            run_tier(args.sheet_id, u)
            time.sleep(1.5)


if __name__ == "__main__":
    main()
