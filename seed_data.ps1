# Ulwandle Tech - Sample Data Seeding Script
$baseUrl = "http://localhost:8000/api/v1"

Write-Host "Adding Sample Data to Ulwandle Tech..." -ForegroundColor Cyan
Write-Host ""

# 1. Add Districts
Write-Host "Adding Districts..." -ForegroundColor Yellow

$districts = @(
    @{
        name = "Cape Town Central"
        code = "CPT-001"
        municipality = "City of Cape Town"
        province = "Western Cape"
        population = 433000
        area_km2 = 400.3
        latitude = -33.9249
        longitude = 18.4241
    },
    @{
        name = "Johannesburg North"
        code = "JHB-001"
        municipality = "City of Johannesburg"
        province = "Gauteng"
        population = 580000
        area_km2 = 530.7
        latitude = -26.2041
        longitude = 28.0473
    },
    @{
        name = "Durban Coastal"
        code = "DBN-001"
        municipality = "eThekwini"
        province = "KwaZulu-Natal"
        population = 370000
        area_km2 = 280.5
        latitude = -29.8587
        longitude = 31.0218
    },
    @{
        name = "Pretoria East"
        code = "PTA-001"
        municipality = "City of Tshwane"
        province = "Gauteng"
        population = 425000
        area_km2 = 390.2
        latitude = -25.7479
        longitude = 28.2293
    },
    @{
        name = "Port Elizabeth Central"
        code = "PE-001"
        municipality = "Nelson Mandela Bay"
        province = "Eastern Cape"
        population = 312000
        area_km2 = 251.8
        latitude = -33.9608
        longitude = 25.6022
    }
)

foreach ($district in $districts) {
    try {
        $body = $district | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/districts/" -Method Post -Body $body -ContentType "application/json"
        Write-Host "  Added: $($district.name)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Warning: $($district.name) may already exist" -ForegroundColor Yellow
    }
}

Write-Host ""

# 2. Add Sensors
Write-Host "Adding Sensors..." -ForegroundColor Yellow

$sensors = @(
    @{ sensor_id = "SENSOR-CPT-001"; sensor_type = "flow"; district_id = 1; location_name = "Cape Town Main Pipeline"; latitude = -33.9249; longitude = 18.4241 },
    @{ sensor_id = "SENSOR-CPT-002"; sensor_type = "pressure"; district_id = 1; location_name = "Cape Town Reservoir"; latitude = -33.9300; longitude = 18.4200 },
    @{ sensor_id = "SENSOR-JHB-001"; sensor_type = "flow"; district_id = 2; location_name = "Johannesburg North Pipeline"; latitude = -26.2041; longitude = 28.0473 },
    @{ sensor_id = "SENSOR-DBN-001"; sensor_type = "flow"; district_id = 3; location_name = "Durban Coastal Main"; latitude = -29.8587; longitude = 31.0218 },
    @{ sensor_id = "SENSOR-PTA-001"; sensor_type = "flow"; district_id = 4; location_name = "Pretoria East Pipeline"; latitude = -25.7479; longitude = 28.2293 },
    @{ sensor_id = "SENSOR-PE-001"; sensor_type = "flow"; district_id = 5; location_name = "PE Central Distribution"; latitude = -33.9608; longitude = 25.6022 }
)

foreach ($sensor in $sensors) {
    try {
        $body = $sensor | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/monitoring/sensors" -Method Post -Body $body -ContentType "application/json"
        Write-Host "  Added: $($sensor.sensor_id)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Warning: $($sensor.sensor_id) may already exist" -ForegroundColor Yellow
    }
}

Write-Host ""

# 3. Add Valves
Write-Host "Adding Valves..." -ForegroundColor Yellow

$valves = @(
    @{ valve_id = "VALVE-CPT-001"; name = "Cape Town Main Valve"; district_id = 1; location_name = "Cape Town Control"; latitude = -33.9249; longitude = 18.4241; can_auto_close = $false },
    @{ valve_id = "VALVE-JHB-001"; name = "Johannesburg North Valve"; district_id = 2; location_name = "JHB Control"; latitude = -26.2041; longitude = 28.0473; can_auto_close = $false },
    @{ valve_id = "VALVE-DBN-001"; name = "Durban Coastal Valve"; district_id = 3; location_name = "Durban Control"; latitude = -29.8587; longitude = 31.0218; can_auto_close = $true },
    @{ valve_id = "VALVE-PTA-001"; name = "Pretoria East Valve"; district_id = 4; location_name = "Pretoria Control"; latitude = -25.7479; longitude = 28.2293; can_auto_close = $false },
    @{ valve_id = "VALVE-PE-001"; name = "PE Main Valve"; district_id = 5; location_name = "PE Control"; latitude = -33.9608; longitude = 25.6022; can_auto_close = $false }
)

foreach ($valve in $valves) {
    try {
        $body = $valve | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/kill-switch/valves" -Method Post -Body $body -ContentType "application/json"
        Write-Host "  Added: $($valve.valve_id)" -ForegroundColor Green
    }
    catch {
        Write-Host "  Warning: $($valve.valve_id) may already exist" -ForegroundColor Yellow
    }
}

Write-Host ""

# 4. Add Water Quality Readings
Write-Host "Adding Water Quality Readings..." -ForegroundColor Yellow

$qualityReadings = @(
    @{ district_id = 1; ph = 7.2; tds = 850; turbidity = 2.1; temperature = 18.5; chlorine = 1.2 },
    @{ district_id = 2; ph = 7.0; tds = 920; turbidity = 3.2; temperature = 19.2; chlorine = 1.0 },
    @{ district_id = 3; ph = 5.8; tds = 1350; turbidity = 6.5; temperature = 22.1; chlorine = 0.5 },
    @{ district_id = 4; ph = 6.8; tds = 780; turbidity = 2.8; temperature = 17.9; chlorine = 1.3 },
    @{ district_id = 5; ph = 6.2; tds = 1150; turbidity = 4.8; temperature = 20.5; chlorine = 0.8 }
)

foreach ($reading in $qualityReadings) {
    try {
        $body = $reading | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/water-quality/readings" -Method Post -Body $body -ContentType "application/json"
        $status = if ($reading.ph -lt 6.0 -or $reading.tds -gt 1200) { "ALERT" } else { "OK" }
        Write-Host "  District $($reading.district_id): pH=$($reading.ph), TDS=$($reading.tds) - $status" -ForegroundColor $(if ($status -eq "OK") { "Green" } else { "Red" })
    }
    catch {
        Write-Host "  Error adding reading for District $($reading.district_id)" -ForegroundColor Red
    }
}

Write-Host ""

# 5. Add Flow Readings
Write-Host "Adding Flow Readings..." -ForegroundColor Yellow

for ($i = 1; $i -le 6; $i++) {
    $flowRate = Get-Random -Minimum 80 -Maximum 150
    $reading = @{
        sensor_id = $i
        flow_rate = $flowRate
        total_volume = $flowRate * 60
    }
    
    try {
        $body = $reading | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/monitoring/flow-readings" -Method Post -Body $body -ContentType "application/json"
        Write-Host "  Sensor $i : $flowRate L/min" -ForegroundColor Green
    }
    catch {
        Write-Host "  Error adding flow reading for Sensor $i" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Sample data added successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Open dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "View API docs: http://localhost:8000/docs" -ForegroundColor Cyan
