const PGListing = require('../models/PGListing');

// Haversine formula for calculating distance in km between two lat/lng points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place (e.g., 1.5 km)
}

/**
 * Intelligent AI Recommendation Engine for PGs using live MongoDB data
 */
exports.getRecommendations = async (userMessage, conversationHistory = [], userLocation = null) => {
  const queryText = userMessage.toLowerCase();

  // 1. Fetch all available PGs from MongoDB
  const pgs = await PGListing.find({ isAvailable: true }).populate('owner', 'name phone');

  if (!pgs || pgs.length === 0) {
    return {
      reply: 'No places are listed yet. New PGs and flats show up as soon as owners add them, so check back soon.',
      recommendations: [],
    };
  }

  // 2. Parse query parameters
  const isNearMeQuery = queryText.includes('near me') || queryText.includes('nearby') || queryText.includes('around me') || queryText.includes('my location');

  // Star Rating parsing (e.g. "4 star", "4+ star", "5 star", "3.5 star")
  let minRating = null;
  const starMatch = queryText.match(/(\d(?:\.\d)?)\s*(?:\+|\s*plus)?\s*star/i) || queryText.match(/(\d(?:\.\d)?)\s*\+/i);
  if (starMatch) {
    minRating = parseFloat(starMatch[1]);
  } else if (queryText.includes('top rated') || queryText.includes('best rated') || queryText.includes('high rating')) {
    minRating = 4.0;
  }

  // City detection
  const knownCities = ['bangalore', 'bengaluru', 'pune', 'hyderabad', 'chennai', 'mumbai', 'delhi', 'jorhat', 'kolkata'];
  let detectedCity = knownCities.find((c) => queryText.includes(c));
  if (detectedCity === 'bengaluru') detectedCity = 'bangalore';

  // Budget detection (e.g., "8000", "8k", "under 10,000")
  let maxBudget = null;
  const budgetMatch = queryText.match(/(?:under|below|less than|max|budget|\u20B9|rs\.?)\s*(\d{4,6}|\d{1,2}k)/i) ||
                      queryText.match(/(\d{1,2}k|\d{4,6})/i);
  if (budgetMatch) {
    const rawVal = budgetMatch[1].toLowerCase();
    maxBudget = rawVal.endsWith('k') ? parseFloat(rawVal.replace('k', '')) * 1000 : parseInt(rawVal, 10);
  }

  // Gender preference
  let genderPref = null;
  if (queryText.includes('girl') || queryText.includes('female') || queryText.includes('women')) {
    genderPref = 'female';
  } else if (queryText.includes('boy') || queryText.includes('male') || queryText.includes('men')) {
    genderPref = 'male';
  } else if (queryText.includes('coed') || queryText.includes('co-ed')) {
    genderPref = 'any';
  }

  // Amenities detection
  const targetAmenities = [];
  if (queryText.includes('wifi') || queryText.includes('internet')) targetAmenities.push('wifi');
  if (queryText.includes('ac') || queryText.includes('air conditioning')) targetAmenities.push('ac');
  if (queryText.includes('meal') || queryText.includes('food')) targetAmenities.push('meals');
  if (queryText.includes('parking')) targetAmenities.push('parking');
  if (queryText.includes('laundry')) targetAmenities.push('laundry');
  if (queryText.includes('tv')) targetAmenities.push('tv');
  if (queryText.includes('power') || queryText.includes('backup')) targetAmenities.push('power-backup');
  if (queryText.includes('gym')) targetAmenities.push('gym');
  if (queryText.includes('security') || queryText.includes('cctv')) targetAmenities.push('security');

  // 3. Score and rank listings
  const scoredPGs = pgs.map((pg) => {
    let score = 0;
    let distanceKm = null;

    // Calculate distance if coordinates exist
    if (userLocation && userLocation.lat && userLocation.lng && pg.location.coordinates?.lat && pg.location.coordinates?.lng) {
      distanceKm = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        pg.location.coordinates.lat,
        pg.location.coordinates.lng
      );
    }

    // Near me scoring
    if (isNearMeQuery) {
      if (distanceKm !== null) {
        if (distanceKm <= 5) score += 50;
        else if (distanceKm <= 15) score += 30;
        else if (distanceKm <= 35) score += 15;
        else score += 5;
      } else {
        score += 10;
      }
    }

    // City match
    if (detectedCity) {
      if (pg.location.city.toLowerCase().includes(detectedCity)) {
        score += 40;
      } else {
        score -= 25;
      }
    }

    // Star rating filter/bonus
    if (minRating !== null) {
      const avg = pg.ratingAverage || 0;
      if (avg >= minRating) {
        score += 35 + avg * 5;
      } else {
        score -= 30;
      }
    } else if (pg.ratingAverage > 0) {
      score += pg.ratingAverage * 4;
    }

    // Budget match
    if (maxBudget !== null) {
      if (pg.rent <= maxBudget) score += 25;
      else score -= 15;
    }

    // Gender match
    if (genderPref) {
      if (pg.genderPreference === genderPref || pg.genderPreference === 'any') score += 20;
      else score -= 30;
    }

    // Amenities match
    targetAmenities.forEach((a) => {
      if (pg.amenities && pg.amenities.includes(a)) {
        score += 15;
      } else {
        score -= 5;
      }
    });

    return { pg, score, distanceKm };
  });

  // Filter positive scores and sort
  let topMatches = scoredPGs
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.pg);

  // Fallback to top listings if no strict match
  if (topMatches.length === 0) {
    topMatches = pgs
      .sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0))
      .slice(0, 3);
  }

  // 4. Construct tailored natural language summary
  let replyText = '';

  const places = (n) => `${n} ${n === 1 ? 'place' : 'places'}`;

  if (isNearMeQuery && minRating !== null) {
    replyText = `${places(topMatches.length)} near you rated **${minRating}+ stars**:`;
  } else if (isNearMeQuery && targetAmenities.length > 0) {
    const amenitiesList = targetAmenities.map(a => a.toUpperCase()).join(', ');
    replyText = `${places(topMatches.length)} near you with **${amenitiesList}**:`;
  } else if (isNearMeQuery) {
    replyText = 'These are the closest to you:';
  } else if (minRating !== null) {
    replyText = `Places rated **${minRating}+ stars**:`;
  } else if (targetAmenities.length > 0) {
    replyText = `Places with ${targetAmenities.join(', ')}:`;
  } else {
    replyText = 'These look like a good match:';
  }

  return {
    reply: replyText,
    recommendations: topMatches,
  };
};
