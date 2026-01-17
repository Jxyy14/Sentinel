import api from './api'

/**
 * Automatically call safety contacts with AI assistant
 * This function can be called from anywhere in the app when a safety alert is triggered
 * 
 * @param {Object} options
 * @param {string} options.reason - Reason for the call (e.g., "SOS activated", "Check-in missed", "Trip timer expired")
 * @param {Object} [options.location] - User's location { lat, lng, address }
 * @param {string} [options.additionalInfo] - Any additional information to share
 * @returns {Promise<Object>} - Call results
 */
export async function callSafetyContacts({ reason, location = null, additionalInfo = '' }) {
  try {
    // If location not provided, try to get it
    let userLocation = location
    if (!userLocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          })
        })

        const lat = position.coords.latitude
        const lng = position.coords.longitude
        let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`

        // Try reverse geocoding
        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          )
          const geoData = await geoResponse.json()
          if (geoData.display_name) {
            address = geoData.display_name
          }
        } catch (e) {
          console.log('Reverse geocoding failed:', e)
        }

        userLocation = { lat, lng, address }
      } catch (e) {
        console.log('Location unavailable:', e)
        userLocation = { address: 'Location unknown' }
      }
    }

    // Call the API
    const result = await api.callSafetyContacts({
      reason,
      location: userLocation,
      additionalInfo
    })

    console.log('Safety contact calls initiated:', result)
    return result
  } catch (error) {
    console.error('Failed to call safety contacts:', error)
    throw error
  }
}

/**
 * Predefined call reasons for common safety scenarios
 */
export const CallReasons = {
  SOS_ACTIVATED: 'SOS activated - emergency assistance may be needed',
  CHECKIN_MISSED: 'Check-in missed - user did not check in on time',
  TRIP_EXPIRED: 'Trip timer expired - user may be in danger',
  SILENT_SOS: 'Silent SOS activated - user may be in danger and unable to speak',
  EMERGENCY_BUTTON: 'Emergency button pressed - user needs immediate help',
  LOCATION_ALERT: 'User left safe location unexpectedly'
}
