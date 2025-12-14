import 'dotenv/config';
import { REST } from 'discord.js';
import { SlashCommandBuilder, Routes } from 'discord.js';
import fs from 'fs';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing DISCORD_TOKEN, DISCORD_CLIENT_ID or DISCORD_GUILD_ID environment variables.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('管理用戶銀幣')
    .setDefaultMemberPermissions(0x20)
    .addStringOption(option =>
      option.setName('action')
        .setDescription('選擇操作類型')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('目標成員')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('金額')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('account')
    .setDescription('查詢成員的銀幣數量')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('要查詢的成員')
    ),
  new SlashCommandBuilder()
    .setName('give')
    .setDescription('轉帳銀幣給其他成員')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('要轉帳的成員')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('轉帳金額')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('split')
    .setDescription('分錢結算')
    .setDefaultMemberPermissions(0x20)
    .addIntegerOption(option =>
      option.setName('總收入')
        .setDescription('總收入')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('修裝費')
        .setDescription('修裝費')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option.setName('稅率')
        .setDescription('稅率(%)')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('隊長')
        .setDescription('隊長')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('成員')
        .setDescription('成員（可同時@多名）')
        .setRequired(true)
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
})();
