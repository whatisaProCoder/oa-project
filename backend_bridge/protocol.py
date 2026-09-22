import struct

# The ESP32 struct_message (80 bytes per struct on 32-bit Xtensa architecture):
# uint8_t id (1 byte)
# 3 bytes padding (due to 32-bit boundary alignment)
# Primary IMU:
# float accelX, accelY, accelZ (12 bytes)
# float gyroX, gyroY, gyroZ (12 bytes)
# Secondary Foot IMU:
# float footAccelX, footAccelY, footAccelZ (12 bytes)
# float footGyroX, footGyroY, footGyroZ (12 bytes)
# Other Sensors:
# float temperature (4 bytes)
# int emgValue (4 bytes)
# int fsrHeel, fsrM5, fsrM1, fsrToe (16 bytes)
# int32_t micData (4 bytes)
#
# Total: 1 + 3 + 24 + 24 + 4 + 4 + 16 + 4 = 80 bytes.
# Little-endian format: <B3x13f6i
STRUCT_FMT = "<B3x13f6i"
STRUCT_SIZE = struct.calcsize(STRUCT_FMT) # 80 bytes

# Legacy 44-byte format from early mock testing: <B3x7f3i
LEGACY_STRUCT_FMT = "<B3x7f3i"
LEGACY_STRUCT_SIZE = struct.calcsize(LEGACY_STRUCT_FMT) # 44 bytes

EXPECTED_PAYLOAD_SIZE = STRUCT_SIZE * 4 # 320 bytes (4 nodes: 0=Master, 1=LeftUpper, 2=LeftLower, 3=RightLower)

def decode_payload(payload_bytes: bytes) -> list:
    """
    Decodes the UDP payload from the Master ESP32 into a list of node dictionaries.
    Standard: 320 bytes (4 nodes x 80 bytes).
    Also supports legacy 44-byte formats (176 or 264 bytes) for backwards compatibility.
    """
    if len(payload_bytes) == EXPECTED_PAYLOAD_SIZE or len(payload_bytes) == STRUCT_SIZE * 4:
        num_nodes = 4
        nodes = []
        for i in range(num_nodes):
            offset = i * STRUCT_SIZE
            chunk = payload_bytes[offset:offset + STRUCT_SIZE]
            unpacked = struct.unpack(STRUCT_FMT, chunk)
            node_id = unpacked[0]
            if not (0 <= node_id <= 5):
                raise ValueError(f"Invalid node ID detected: {node_id}. Packet may be corrupted.")
            
            node_data = {
                "id": node_id,
                "accelX": unpacked[1],
                "accelY": unpacked[2],
                "accelZ": unpacked[3],
                "gyroX": unpacked[4],
                "gyroY": unpacked[5],
                "gyroZ": unpacked[6],
                "footAccelX": unpacked[7],
                "footAccelY": unpacked[8],
                "footAccelZ": unpacked[9],
                "footGyroX": unpacked[10],
                "footGyroY": unpacked[11],
                "footGyroZ": unpacked[12],
                "temperature": unpacked[13],
                "emgValue": unpacked[14],
                "fsrHeel": unpacked[15],
                "fsrM5": unpacked[16],
                "fsrM1": unpacked[17],
                "fsrToe": unpacked[18],
                "micData": unpacked[19],
                "fsrValue": unpacked[15] + unpacked[16] + unpacked[17] + unpacked[18]
            }
            nodes.append(node_data)
        return nodes

    # Support legacy 44-byte format (176 bytes for 4 nodes or 264 bytes for 6 nodes)
    elif len(payload_bytes) in (LEGACY_STRUCT_SIZE * 4, LEGACY_STRUCT_SIZE * 6):
        num_nodes = len(payload_bytes) // LEGACY_STRUCT_SIZE
        nodes = []
        for i in range(num_nodes):
            offset = i * LEGACY_STRUCT_SIZE
            chunk = payload_bytes[offset:offset + LEGACY_STRUCT_SIZE]
            unpacked = struct.unpack(LEGACY_STRUCT_FMT, chunk)
            node_id = unpacked[0]
            if not (0 <= node_id <= 5):
                raise ValueError(f"Invalid node ID detected: {node_id}. Packet may be corrupted.")
            node_data = {
                "id": node_id,
                "accelX": unpacked[1],
                "accelY": unpacked[2],
                "accelZ": unpacked[3],
                "gyroX": unpacked[4],
                "gyroY": unpacked[5],
                "gyroZ": unpacked[6],
                "footAccelX": 0.0,
                "footAccelY": 0.0,
                "footAccelZ": 0.0,
                "footGyroX": 0.0,
                "footGyroY": 0.0,
                "footGyroZ": 0.0,
                "temperature": unpacked[7],
                "emgValue": unpacked[8],
                "fsrHeel": unpacked[9] // 4,
                "fsrM5": unpacked[9] // 4,
                "fsrM1": unpacked[9] // 4,
                "fsrToe": unpacked[9] // 4,
                "fsrValue": unpacked[9],
                "micData": unpacked[10]
            }
            nodes.append(node_data)
        return nodes
    else:
        raise ValueError(f"Invalid payload size. Expected {EXPECTED_PAYLOAD_SIZE} bytes (4 nodes x 80 bytes), got {len(payload_bytes)}")
