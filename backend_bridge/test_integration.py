import unittest
from backend_bridge.inference_service import map_sensors_to_features
from backend_bridge.test_simulated_sender import generate_synthetic_payload
from backend_bridge.protocol import decode_payload

class TestIntegration(unittest.TestCase):
    
    def test_feature_mapping(self):
        """Test that decoded nodes correctly map into the 4 required ML features."""
        payload = generate_synthetic_payload()
        nodes = decode_payload(payload)
        
        features = map_sensors_to_features(nodes)
        
        # Check that exactly 4 features are returned
        self.assertCountEqual(
            list(features.keys()), 
            ['knee_variance', 'pressure_asymmetry', 'emg_amplitude', 'gait_speed']
        )
        
        # Pressure asymmetry should be a normalized value between 0.0 and 1.0
        self.assertGreaterEqual(features['pressure_asymmetry'], 0.0)
        self.assertLessEqual(features['pressure_asymmetry'], 1.0)
        
        # Test values are valid numbers
        for val in features.values():
            self.assertIsInstance(val, float)
            
    def test_invalid_node_count(self):
        """Test that mapping fails if not exactly 4 nodes are provided."""
        with self.assertRaises(ValueError):
            map_sensors_to_features([{"id": 0}])

if __name__ == "__main__":
    unittest.main()
