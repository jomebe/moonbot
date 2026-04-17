export type TurnSource = 'jsons' | 'files';

export interface TurnLookupResult {
  requestedGameId: string;
  resolvedGameId: string;
  currentPlayer: string;
  turn?: number;
  updatedAt?: string;
  checkedAt: string;
  source: TurnSource;
  matchedPlayerField: string;
  matchedTurnField?: string;
  matchedUpdatedAtField?: string;
}

export interface GameSummaryResult {
  requestedGameId: string;
  resolvedGameId: string;
  currentPlayer: string;
  turn?: number;
  updatedAt?: string;
  civilizations: string[];
  humanCivilizations: string[];
  checkedAt: string;
  source: TurnSource;
  matchedPlayerField: string;
  matchedTurnField?: string;
  matchedUpdatedAtField?: string;
  matchedCivilizationsField?: string;
}

export interface ServerAliveResult {
  authVersion: number;
  chatVersion: number;
  checkedAt: string;
}

export interface ParserContext {
  requestedGameId: string;
  resolvedGameId: string;
  source: TurnSource;
}
