"use client";
import { createContext, useContext } from "react";

// Opens the details of a match of the page (from a card, a schedule row or a bracket box): useOpenMatch()(event, id).
// Null outside a MatchModalProvider (the editor), where match boxes are not clickable.
export const OpenMatchCtx = createContext(null);
export const useOpenMatch = () => useContext(OpenMatchCtx);
