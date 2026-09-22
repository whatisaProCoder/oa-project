import socket
import logging
from backend_bridge.config import UDP_HOST, UDP_PORT, LOG_LEVEL
from backend_bridge.protocol import decode_payload
from backend_bridge.inference_service import process_payload

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper(), logging.INFO), format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global state to hold the latest processed data for the API
LATEST_DATA = {
    "raw_nodes": None,
    "features": None,
    "ml_result": None,
    "timestamp": None
}

def start_receiver():
    import time
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((UDP_HOST, UDP_PORT))
        logger.info(f"UDP Receiver listening on {UDP_HOST}:{UDP_PORT}...")
    except Exception as e:
        logger.error(f"Failed to bind UDP socket: {e}")
        return

    try:
        while True:
            # We expect 176 bytes, but let's read up to 1024 to catch malformed larger packets
            data, addr = sock.recvfrom(1024)
            logger.debug(f"Received {len(data)} bytes from {addr}")

            try:
                nodes = decode_payload(data)
                
                # Update global state for real-time visualizer
                LATEST_DATA["raw_nodes"] = nodes
                LATEST_DATA["timestamp"] = time.time()
                
            except ValueError as ve:
                logger.warning(f"Invalid packet from {addr}: {ve}")
            except Exception as e:
                logger.error(f"Error processing packet from {addr}: {e}")

    except KeyboardInterrupt:
        logger.info("Shutting down UDP Receiver gracefully...")
    finally:
        sock.close()

if __name__ == "__main__":
    start_receiver()
