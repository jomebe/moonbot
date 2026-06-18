import { uncivTurnCommand } from './uncivTurn.js';
import { linkGameCommand } from './linkGame.js';
import { unlinkGameCommand } from './unlinkGame.js';
import { registerPlayerCommand } from './registerPlayer.js';
import { removeCommand } from './remove.js';
import type { SlashCommandModule } from './types.js';

export const commandList: SlashCommandModule[] = [
  uncivTurnCommand,
  linkGameCommand,
  unlinkGameCommand,
  registerPlayerCommand,
  removeCommand,
];

export const commandMap = new Map<string, SlashCommandModule>(
  commandList.map(command => [command.data.name, command])
);

export const commandJson = commandList.map(command => command.data.toJSON());
