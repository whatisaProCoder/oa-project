import unittest
from backend_bridge.protocol import decode_payload, EXPECTED_PAYLOAD_SIZE
from backend_bridge.test_simulated_sender import generate_synthetic_payload

class TestProtocol(unittest.TestCase):
    
    def test_valid_payload_decoding(self):
        """Test that a valid 320-byte payload decodes correctly."""
        payload = generate_synthetic_payload()
        nodes = decode_payload(payload)
        
        self.assertEqual(len(nodes), 4)
        
        # Check Node 0 (Master)
        self.assertEqual(nodes[0]["id"], 0)
        self.assertAlmostEqual(nodes[0]["accelZ"], 9.81, places=1)
        self.assertAlmostEqual(nodes[0]["temperature"], 37.0, places=0)
        
        # Check Node 1 (Left Upper)
        self.assertEqual(nodes[1]["id"], 1)
        self.assertAlmostEqual(nodes[1]["temperature"], 37.0, places=0)
        
        # Check Node 2 (Left Lower)
        self.assertEqual(nodes[2]["id"], 2)
        self.assertAlmostEqual(nodes[2]["temperature"], 37.0, places=0)
        
    def test_invalid_payload_length(self):
        """Test that incorrect payload lengths raise ValueError."""
        short_payload = b"\x00" * 100
        with self.assertRaises(ValueError):
            decode_payload(short_payload)
            
        long_payload = b"\x00" * 200
        with self.assertRaises(ValueError):
            decode_payload(long_payload)

    def test_invalid_node_id(self):
        """Test that wildly incorrect node IDs raise ValueError to prevent corrupted data."""
        payload = bytearray(generate_synthetic_payload())
        # Corrupt the ID of the first node to be 99
        payload[0] = 99
        
        with self.assertRaises(ValueError) as context:
            decode_payload(bytes(payload))
        
        self.assertIn("Invalid node ID detected: 99", str(context.exception))

if __name__ == "__main__":
    unittest.main()
