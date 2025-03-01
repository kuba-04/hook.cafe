import type { NDKEvent, NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";

export interface City {
    cityName: string;
    cityCountry: string;
    tz: string;
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

export interface CachedReaction {
    id: string;
    from: string;      // pubkey of who reacted
    to: string;        // pubkey of who was reacted to
    content: string;   // "+" or "-"
    timestamp: number; // when the reaction happened
}

export interface ReactionCache {
    [cityKey: string]: CachedReaction[];
} 