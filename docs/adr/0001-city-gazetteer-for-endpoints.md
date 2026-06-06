# Use a city gazetteer for endpoints

Endpoint and Trip Stop search will use an app-owned contiguous-US city gazetteer rather than a general-purpose geocoder as the primary input path. The app only needs city-level routing places at first, and owning this dataset avoids public geocoding API limits and terms while giving tighter control over endpoint selection; external geocoding can be added later for precise place details.
