#!/bin/bash

# Manual API Testing Script
BASE_URL="http://localhost:3000"
ADMIN_TOKEN="test-admin-token"

echo "=== Reserve API Manual Testing ==="
echo ""

# Test 1: CSV Import
echo "Test 1: Admin CSV Import"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/staffs/import?dryRun=false" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -H "Content-Type: text/csv" \
  -d $'名前(漢字),本部ID,部署,職種\n山田太郎,100001,ER,医師' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"
echo ""

# Test 2: Login
echo "Test 2: Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"staffId":"100001","pin":"0000"}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Test 3: Create Reservation Type (Admin)
echo "Test 3: Create Reservation Type"
RT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/reservation-types" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: rt-$(date +%s)" \
  -d '{"name":"インフルエンザ予防接種","active":true}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$RT_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$RT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"

RT_ID=$(echo "$RT_RESPONSE" | grep -v "HTTP_CODE" | grep -o '"id":[0-9]*' | cut -d: -f2 | head -1)
echo "Reservation Type ID: $RT_ID"
echo ""

# Test 4: Create Slot (Admin)
echo "Test 4: Create Slot"
SLOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/slots/bulk" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: slot-$(date +%s)" \
  -d "{\"slots\":[{\"reservationTypeId\":${RT_ID:-1},\"serviceDateLocal\":\"2025-04-15\",\"startMinuteOfDay\":600,\"durationMinutes\":30,\"capacity\":2,\"status\":\"published\"}]}" \
  -w "\nHTTP_CODE:%{http_code}")
echo "$SLOT_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$SLOT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"

SLOT_ID=$(echo "$SLOT_RESPONSE" | grep -v "HTTP_CODE" | grep -o '"id":[0-9]*' | cut -d: -f2 | head -1)
echo "Slot ID: $SLOT_ID"
echo ""

# Test 5: Update Profile (JWT Required)
echo "Test 5: Update Profile (requires PIN must change = false first)"
PROFILE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/staffs/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":0,"currentPin":"0000","emrPatientId":"900001","dateOfBirth":"1980-05-15","sexCode":"1"}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$PROFILE_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$PROFILE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE (Expected: 428 or success)"
echo ""

# Test 6: Change PIN
echo "Test 6: Change PIN"
PIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/staffs/me/pin" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPin":"0000","newPin":"1234"}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$PIN_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$PIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"
echo ""

# Test 7: Re-login with new PIN
echo "Test 7: Re-login with new PIN"
RELOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"staffId":"100001","pin":"1234"}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$RELOGIN_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$RELOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"

NEW_ACCESS_TOKEN=$(echo "$RELOGIN_RESPONSE" | grep -v "HTTP_CODE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
echo ""

# Test 8: Update Profile Again (after PIN change)
echo "Test 8: Update Profile Again"
PROFILE_RESPONSE2=$(curl -s -X PATCH "$BASE_URL/api/staffs/me" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":0,"currentPin":"1234","emrPatientId":"900001","dateOfBirth":"1980-05-15","sexCode":"1"}' \
  -w "\nHTTP_CODE:%{http_code}")
echo "$PROFILE_RESPONSE2" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$PROFILE_RESPONSE2" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"
echo ""

# Test 9: Create Reservation
echo "Test 9: Create Reservation (JWT Required)"
RESERVATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/reservations" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"slotId\":${SLOT_ID:-1}}" \
  -w "\nHTTP_CODE:%{http_code}")
echo "$RESERVATION_RESPONSE" | grep -v "HTTP_CODE"
HTTP_CODE=$(echo "$RESERVATION_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE"
echo ""

echo "=== Testing Complete ==="
