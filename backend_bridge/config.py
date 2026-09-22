import os

# UDP Settings
# 0.0.0.0 will listen on all available interfaces (including the Pi's Wi-Fi hotspot)
UDP_HOST = os.environ.get("UDP_HOST", "0.0.0.0")
UDP_PORT = int(os.environ.get("UDP_PORT", "12345"))

# Logging Settings
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
