import type { NDKEvent, NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";

export interface City {
    cityName: string;
    cityCountry: string;
}

export interface Author extends NDKUser {
    name?: string;
    picture?: string;
    city?: City;
}

export interface Message {
    event: NDKEvent;
    author?: NDKUserProfile | null;
}

export interface ParsedContent {
    word1: string;
    word2: string;
    word3: string;
    word4: string;
    timeFrom: string;
    timeTo: string;
    location: string;
    city: string;
    minPrice: string;
    maxPrice: string;
}

export interface MessageContent {
    topic1?: string;
    topic2?: string;
    topic3?: string;
    topic4?: string;
    location?: string;
    priceFrom?: string;
    priceTo?: string;
    timeFrom?: string;
    timeTo?: string;
    cityName?: string;
    cityCountry?: string;
}

export interface Avatar {
    path: string;
} 