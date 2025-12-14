import 'dotenv/config';
import { Client, GatewayIntentBits, Events, AttachmentBuilder } from 'discord.js';
import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const TOKEN = process.env.DISCORD_TOKEN;
const DATA_FILE = path.resolve('./silver_data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '{}');
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function drawBalanceChangeCard(name, before, after) {
  const width = 500;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, width-4, height-4);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 70);
  ctx.lineTo(width-10, 70);
  ctx.stroke();

  ctx.font = 'bold 44px Arial';
  ctx.fillStyle = '#F9A9F9';
  ctx.textAlign = 'center';
  ctx.fillText(name, width/2, 55);

  ctx.font = 'bold 44px Arial';
  const splitY = 70;
  const availableH = height - splitY;

  const beforeFont = 'bold 35px Arial';
  const arrowFont = 'bold 30px Arial';
  const afterFont = 'bold 35px Arial';
  const beforeStr = before.toString();
  const arrowStr = 'V';
  const afterStr = after.toString();

  ctx.font = beforeFont;
  const beforeHeight = 35;
  ctx.font = arrowFont;
  const arrowHeight = 30;
  ctx.font = afterFont;
  const afterHeight = 35;
  const lineGap = 10;
  const totalHeight = beforeHeight + arrowHeight + afterHeight + lineGap * 2;

  let baseY = splitY + Math.round((availableH - totalHeight) / 2) + beforeHeight;

  ctx.font = beforeFont;
  ctx.textAlign = 'center';
  ctx.fillStyle = before < 0 ? '#F88' : '#DADADA';
  ctx.fillText(beforeStr, width/2, baseY);

  baseY += lineGap + arrowHeight;
  ctx.font = arrowFont;
  ctx.fillStyle = '#FFD3A5';
  ctx.fillText(arrowStr, width/2, baseY);

  baseY += lineGap + afterHeight;
  ctx.font = afterFont;
  ctx.fillStyle = after < 0 ? '#F88' : '#DADADA';
  ctx.fillText(afterStr, width/2, baseY);


  return canvas.toBuffer('image/png');
}

function extractNameFromNickname(nickname, fallback) {
  if (!nickname) return null;
  const idx = nickname.indexOf('(');
  if (idx > 0) {
    return nickname.slice(0, idx).trim();
  }
  return nickname.trim();
}



const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const channel = interaction.channel;
  if (!channel || !channel.parent || channel.parent.name !== '分錢仔') {
    await interaction.reply({
      content: '此指令限定在類別"分錢"內的頻道使用',
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'split') {
    if (!interaction.member.permissions.has('ManageGuild')) {
      await interaction.reply({ content: '你沒有權限使用此指令', ephemeral: true });
      return;
    }
    const data = loadData();
    const income = interaction.options.getInteger('總收入');
    const repair = interaction.options.getInteger('修裝費');
    const tax = interaction.options.getNumber('稅率');
    const leader = interaction.options.getUser('隊長');
    const memberStr = interaction.options.getString('成員');
    const memberIds = [];
    const mentionRegex = /<@!?(\d+)>/g;
    let match;
    while ((match = mentionRegex.exec(memberStr)) !== null) {
      if (match[1] !== leader.id && !memberIds.includes(match[1])) memberIds.push(match[1]);
    }
    const members = memberIds.map(id => interaction.guild.members.cache.get(id)).filter(Boolean);
    const taxAmount = Math.floor(income * (tax / 100));
    const totalPeople = members.length + 1;
    const distributable = income - repair - taxAmount;
    const perMember = Math.floor(distributable / totalPeople);
    const leaderShare = perMember + repair;
    const leaderMember = interaction.guild.members.cache.get(leader.id);
    const leaderNickname = (leaderMember && (leaderMember.nickname || leaderMember.user.username)) || leader.username;
    data[leader.id] = data[leader.id] || {silver:0, name:leaderNickname};
    data[leader.id].name = leaderNickname;
    data[leader.id].silver += leaderShare;
    for(const m of members){
      const memberNickname = m.nickname || m.user.username;
      data[m.user.id] = data[m.user.id] || {silver:0, name:memberNickname};
      data[m.user.id].name = memberNickname;
      data[m.user.id].silver += perMember;
    }
    const botId = interaction.client.user.id;
    if (!data[botId]) data[botId] = {silver: 0, name: interaction.client.user.username};
    data[botId].silver -= leaderShare + perMember * members.length;
    saveData(data);
    let detail = `👑 隊長 ${interaction.guild.members.cache.get(leader.id)?.displayName||leader.username}: ${leaderShare} 銀幣\n`;
    detail += `👥 隊員 ${members.length} 人: 每人 ${perMember} 銀幣`;
    const embed = {
      color: 0xF7C325,
      title: '💰 分錢結算',
      description:
        `**計算基準**\n` +
        `總收入：${income}\n` +
        `修裝費：${repair}\n` +
        `成員數：${totalPeople} 人\n` +
        `\n**公會稅**\n` +
        `稅率：${tax}%\n` +
        `稅額：${taxAmount}\n` +
        `\n**分配明細**\n` +
        detail +
        `\n\n分錢計算完成。`
    };
    await interaction.reply({ embeds: [embed] });
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const data = loadData();

  if (interaction.commandName === 'account') {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id);
    const nickname = member.nickname || member.user.username;
    let name = extractNameFromNickname(nickname, user.username);
    if (!name) {
      await interaction.reply({ content: '成員名稱異常，無法查詢或註冊', ephemeral: false });
      return;
    }
    if (!data[user.id]) {
      data[user.id] = { silver: 0, name: nickname };
    } else {
      data[user.id].name = nickname;
    }
    saveData(data);
    const silver = data[user.id].silver;
    const width = 500;
    const height = 150;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width-4, height-4);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 65);
    ctx.lineTo(width-10, 65);
    ctx.stroke();

    ctx.font = 'bold 44px Arial';
    ctx.fillStyle = '#F9A9F9';
    ctx.textAlign = 'center';
    ctx.fillText(name, width/2, 50);

    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'center';
    const silverLabel = 'SILVER';
    const silverValue = silver.toString();
    ctx.font = 'bold 38px Arial';
    const labelWidth = ctx.measureText(silverLabel + ' ').width;
    const valueWidth = ctx.measureText(silverValue).width;
    const totalWidth = labelWidth + valueWidth;
    const startX = width/2 - totalWidth/2;
    const splitY = 65;
    const availableH = height - splitY;
    const fontSize = 38;
    const baseY = splitY + Math.round(availableH/2 + fontSize/2) - 5;
    ctx.font = 'bold 38px Arial';
    ctx.fillStyle = '#FFD3A5';
    ctx.textAlign = 'left';
    ctx.fillText(silverLabel + ' ', startX, baseY);
    ctx.font = 'bold 38px Arial';
    ctx.fillStyle = silver < 0 ? '#F88' : '#FFF1E0';
    ctx.fillText(silverValue, startX + labelWidth, baseY);

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'silver.png' });
    await interaction.reply({ files: [attachment] });
  }

  if (interaction.commandName === 'balance') {
    if (!interaction.member.permissions.has('ManageGuild')) {
      await interaction.reply({ content: '你沒有權限使用此指令', ephemeral: true });
      return;
    }
    const action = interaction.options.getString('action');
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (!targetUser || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      await interaction.reply({ content: '請正確輸入 @user 及金額（需大於0）', ephemeral: true });
      return;
    }
    const targetMember = interaction.guild.members.cache.get(targetUser.id) || await interaction.guild.members.fetch(targetUser.id);
    const targetNickname = targetMember?.nickname || targetMember?.user.username || targetUser.username;
    let targetName = extractNameFromNickname(targetNickname, targetUser.username);
    if (!targetName) targetName = targetUser.username;
    if (!data[targetUser.id]) {
      data[targetUser.id] = { silver: 0, name: targetNickname };
    } else {
      data[targetUser.id].name = targetNickname;
    }

    const before = data[targetUser.id].silver;
    let after;
    if (action === 'add') {
      after = before + amount;
      data[targetUser.id].silver = after;
      saveData(data);
    } else if (action === 'remove') {
      after = before - amount;
      data[targetUser.id].silver = after;
      saveData(data);
    } else {
      await interaction.reply({ content: '未知的操作', ephemeral: true });
      return;
    }
    const cardBuffer = drawBalanceChangeCard(targetName, before, after);
    const attachment = new AttachmentBuilder(cardBuffer, { name: 'balance.png' });
    await interaction.reply({ files: [attachment] });
    return;
  }

  if (interaction.commandName === 'give') {
    const fromUser = interaction.user;
    const toUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (fromUser.id === toUser.id) {
      await interaction.reply({ content: '不能轉給自己。', ephemeral: true });
      return;
    }
    const fromMember = interaction.guild.members.cache.get(fromUser.id) || await interaction.guild.members.fetch(fromUser.id);
    const toMember = interaction.guild.members.cache.get(toUser.id) || await interaction.guild.members.fetch(toUser.id);
    const fromNickname = fromMember.nickname || fromMember.user.username;
    const toNickname = toMember.nickname || toMember.user.username;
    let fromName = extractNameFromNickname(fromNickname, fromUser.username);
    let toName = extractNameFromNickname(toNickname, toUser.username);
    if (!fromName) {
      await interaction.reply({ content: '你的成員名稱異常，無法註冊或轉帳', ephemeral: true });
      return;
    }
    if (!data[fromUser.id]) {
      data[fromUser.id] = { silver: 0, name: fromNickname };
    } else {
      data[fromUser.id].name = fromNickname;
    }
    if (!toName) {
      await interaction.reply({ content: '對方成員名稱異常，無法註冊或收款', ephemeral: true });
      return;
    }
    if (!data[toUser.id]) {
      data[toUser.id] = { silver: 0, name: toNickname };
    } else {
      data[toUser.id].name = toNickname;
    }
    if (data[fromUser.id].silver < amount || amount <= 0) {
      await interaction.reply({ content: '銀幣不足或金額無效。', ephemeral: true });
      return;
    }
    data[fromUser.id].silver -= amount;
    data[toUser.id].silver += amount;
    saveData(data);

    const font = 'bold 32px Arial';
    const padding = 20;
    const gap = 30;
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = font;

    const fromNameWidth = tempCtx.measureText(fromName).width;
    const fromAmountText = data[fromUser.id].silver.toString() + `(-${amount})`;
    const fromAmountWidth = tempCtx.measureText(fromAmountText).width;

    const toNameWidth = tempCtx.measureText(toName).width;
    const toAmountText = data[toUser.id].silver.toString() + `(+${amount})`;
    const toAmountWidth = tempCtx.measureText(toAmountText).width;

    const line1Width = fromNameWidth + gap + fromAmountWidth;
    const line2Width = toNameWidth + gap + toAmountWidth;
    const width = Math.max(line1Width, line2Width) + padding * 2;
    const height = 110;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width-4, height-4);
    ctx.font = font;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F3A9F8';
    ctx.fillText(fromName, padding, 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(fromAmountText, width - padding, 42);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#7CF6F9';
    ctx.fillText(toName, padding, 90);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(toAmountText, width - padding, 90);
    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'give_result.png' });
    await interaction.reply({ files: [attachment] });
  }
});

(async () => {
  if (!TOKEN) {
    console.error('Missing DISCORD_TOKEN environment variable.');
    process.exit(1);
  }
  client.login(TOKEN);
})();
