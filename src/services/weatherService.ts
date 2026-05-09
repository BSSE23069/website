
export interface WeatherData {
  time: string;
  waveHeight: number;
  windSpeed: number;
  visibility: number;
}

export async function fetchMaritimeWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const apiKey = import.meta.env.VITE_STORMGLASS_API_KEY;
  if (!apiKey) return null;

  try {
    const params = 'waveHeight,windSpeed,visibility';
    const response = await fetch(
      `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}`,
      {
        headers: {
          'Authorization': apiKey
        }
      }
    );

    if (!response.ok) throw new Error('StormGlass API error');

    const data = await response.json();
    const current = data.hours[0];

    return {
      time: current.time,
      waveHeight: current.waveHeight.sg,
      windSpeed: current.windSpeed.sg,
      visibility: current.visibility.sg
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}
