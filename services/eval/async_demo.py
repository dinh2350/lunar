import asyncio
import time

# Python async is very similar to Node.js!
# But you need asyncio.run() as the entry point

async def fetch_data(source: str, delay: float) -> dict:
    """Simulates an async API call."""
    print(f"  Fetching {source}...")
    await asyncio.sleep(delay)  # = await new Promise(r => setTimeout(r, delay))
    return {"source": source, "data": f"Result from {source}"}

async def main():
    start = time.time()

    # Sequential (one after another)
    r1 = await fetch_data("memory", 0.5)
    r2 = await fetch_data("search", 0.3)
    print(f"Sequential: {time.time() - start:.2f}s")  # ~0.8s

    # Parallel (like Promise.all)
    start = time.time()
    r1, r2 = await asyncio.gather(
        fetch_data("memory", 0.5),
        fetch_data("search", 0.3),
    )
    print(f"Parallel: {time.time() - start:.2f}s")  # ~0.5s

    print(f"Results: {r1}, {r2}")

# Entry point (like calling main() in Node.js)
asyncio.run(main())
