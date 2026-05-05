import { GameService } from '../services/game.service.js'
import type { ColorHSL } from '../types/index.js'

export function calculateMultiplayerAccuracy(original: ColorHSL, user: ColorHSL): { accuracy: number; score: number } {
  const accuracy = GameService.calculateAccuracy(original, user)
  return {
    accuracy: Math.round(accuracy * 1000) / 1000,
    score: Math.round(accuracy * 1000) / 1000, // No multipliers in multiplayer
  }
}