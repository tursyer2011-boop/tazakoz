import { describe, expect, test } from "bun:test";
import { MAP_WEATHER_LOCATION } from "./map-weather-location";

describe("map weather region", () => {
  test("uses Mangystau only", () => {
    expect(MAP_WEATHER_LOCATION.region).toBe("Мангистауская область");
    expect(MAP_WEATHER_LOCATION.lat).toBe(43.6512);
    expect(MAP_WEATHER_LOCATION.lng).toBe(51.1575);
  });
});