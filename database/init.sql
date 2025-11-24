-- Ulwandle Tech Database Initialization
-- TimescaleDB for time-series water monitoring data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable PostGIS for geospatial data (optional but useful for mapping)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Create hypertables for time-series data
-- This will be executed after table creation

-- Function to create hypertables
CREATE OR REPLACE FUNCTION create_hypertables()
RETURNS void AS $$
BEGIN
    -- Convert flow_readings to hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'flow_readings') THEN
        PERFORM create_hypertable('flow_readings', 'recorded_at', if_not_exists => TRUE);
    END IF;

    -- Convert pressure_readings to hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pressure_readings') THEN
        PERFORM create_hypertable('pressure_readings', 'recorded_at', if_not_exists => TRUE);
    END IF;

    -- Convert water_quality_readings to hypertable
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'water_quality_readings') THEN
        PERFORM create_hypertable('water_quality_readings', 'recorded_at', if_not_exists => TRUE);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert sample South African districts
INSERT INTO districts (name, code, municipality, province, population, area_km2, latitude, longitude, status)
VALUES
    ('Cape Town Central', 'CPT-001', 'City of Cape Town', 'Western Cape', 433000, 400.3, -33.9249, 18.4241, 'green'),
    ('Johannesburg North', 'JHB-001', 'City of Johannesburg', 'Gauteng', 580000, 530.7, -26.2041, 28.0473, 'green'),
    ('Durban Coastal', 'DBN-001', 'eThekwini', 'KwaZulu-Natal', 370000, 280.5, -29.8587, 31.0218, 'yellow'),
    ('Pretoria East', 'PTA-001', 'City of Tshwane', 'Gauteng', 425000, 390.2, -25.7479, 28.2293, 'green'),
    ('Port Elizabeth', 'PE-001', 'Nelson Mandela Bay', 'Eastern Cape', 312000, 251.8, -33.9608, 25.6022, 'yellow')
ON CONFLICT DO NOTHING;

-- Insert sample sensors
INSERT INTO sensors (sensor_id, sensor_type, district_id, location_name, latitude, longitude, is_active)
SELECT
    'SENSOR-' || lpad(id::text, 4, '0'),
    CASE (random() * 3)::int
        WHEN 0 THEN 'flow'
        WHEN 1 THEN 'pressure'
        ELSE 'flow'
    END,
    id,
    name || ' Main Pipeline',
    latitude + (random() - 0.5) * 0.1,
    longitude + (random() - 0.5) * 0.1,
    TRUE
FROM districts
LIMIT 10
ON CONFLICT DO NOTHING;

-- Insert sample valves
INSERT INTO valves (valve_id, name, district_id, location_name, latitude, longitude, status, is_remote_controlled)
SELECT
    'VALVE-' || lpad(id::text, 4, '0'),
    name || ' Main Valve',
    id,
    name || ' Control Point',
    latitude + (random() - 0.5) * 0.1,
    longitude + (random() - 0.5) * 0.1,
    'open',
    TRUE
FROM districts
LIMIT 10
ON CONFLICT DO NOTHING;

-- Insert sample employees
INSERT INTO employees (employee_id, name, role, phone, email, assigned_district_id, is_active, is_on_duty)
VALUES
    ('EMP-001', 'Thabo Mbeki', 'technician', '+27123456789', 'thabo.m@ulwandle.tech', 1, TRUE, TRUE),
    ('EMP-002', 'Zanele Khumalo', 'engineer', '+27123456790', 'zanele.k@ulwandle.tech', 2, TRUE, TRUE),
    ('EMP-003', 'Pieter van der Merwe', 'supervisor', '+27123456791', 'pieter.v@ulwandle.tech', 3, TRUE, FALSE),
    ('EMP-004', 'Nomsa Dlamini', 'technician', '+27123456792', 'nomsa.d@ulwandle.tech', 4, TRUE, TRUE),
    ('EMP-005', 'Johan Botha', 'engineer', '+27123456793', 'johan.b@ulwandle.tech', 5, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_flow_readings_sensor_time ON flow_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pressure_readings_sensor_time ON pressure_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_water_quality_district_time ON water_quality_readings(district_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_district_resolved ON alerts(district_id, is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_districts_status ON districts(status);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ulwandle;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ulwandle;
