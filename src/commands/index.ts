import { botInfoCommand } from './botInfo.js';
import { civilizationsCommand } from './civilizations.js';
import { gameSummaryCommand } from './gameSummary.js';
import { gameIdCheckCommand } from './gameIdCheck.js';
import { helpCommand } from './help.js';
import { lookupMetaCommand } from './lookupMeta.js';
import { pingCommand } from './ping.js';
import { serverStatusCommand } from './serverStatus.js';
import { uncivTurnCommand } from './uncivTurn.js';
import { linkGameCommand } from './linkGame.js';
import { unlinkGameCommand } from './unlinkGame.js';
import { registerPlayerCommand } from './registerPlayer.js';
import type { SlashCommandModule } from './types.js';

export const commandList: SlashCommandModule[] = [
  uncivTurnCommand,
  linkGameCommand,
  unlinkGameCommand,
  registerPlayerCommand,
  gameSummaryCommand,
  civilizationsCommand,
  lookupMetaCommand,
  gameIdCheckCommand,
  serverStatusCommand,
  pingCommand,
  botInfoCommand,
  helpCommand,
];

export const commandMap = new Map<string, SlashCommandModule>(
  commandList.map(command => [command.data.name, command])
);

export const commandJson = commandList.map(command => command.data.toJSON());
