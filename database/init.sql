-- Ulwandle Tech Database Initialization
-- TimescaleDB for time-series water monitoring data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable PostGIS for geospatial data (optional but useful for mapping)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to create hypertables
-- This will be called after tables are created by the backend
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

-- Note: Tables will be created by the FastAPI backend (SQLAlchemy)
-- After backend starts and creates tables, you can add sample data using the API
-- or by connecting to the database and running INSERT statements manually
