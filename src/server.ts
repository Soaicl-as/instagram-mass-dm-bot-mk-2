import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface InstagramAutomation {
  username: string;
  extractType: 'followers' | 'following';
  message: string;
  delayBetweenMsgs: number;
  maxAccounts: number;
}

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;

if (!INSTAGRAM_USERNAME || !INSTAGRAM_PASSWORD) {
  throw new Error('Instagram credentials must be set in environment variables');
}

let stopProcess = false;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserList(
  page: puppeteer.Page,
  targetUsername: string,
  extractType: 'followers' | 'following',
  maxAccounts: number
): Promise<string[]> {
  await page.goto(`https://www.instagram.com/${targetUsername}/${extractType}/`);
  await delay(3000);

  const users: string[] = [];
  const scrollAttempts = Math.min(3, maxAccounts / 10);

  for (let i = 0; i < scrollAttempts && !stopProcess; i++) {
    const newUsers = await page.evaluate(() => {
      const elements = document.querySelectorAll('div[role="dialog"] a[role="link"][title]');
      return Array.from(elements).map(el => el.getAttribute('title')).filter(Boolean);
    });

    users.push(...newUsers);
    if (users.length >= maxAccounts) break;

    await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (dialog) dialog.scrollTo(0, dialog.scrollHeight);
    });
    await delay(1500);
  }

  return [...new Set(users)].slice(0, maxAccounts);
}

async function sendMassDM(socket: any, data: InstagramAutomation) {
  const { username, extractType, message, delayBetweenMsgs, maxAccounts } = data;
  let browser;
  let processedCount = 0;

  try {
    socket.emit('update', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    socket.emit('update', 'Logging in to Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/');
    await delay(2000);

    await page.type('input[name="username"]', INSTAGRAM_USERNAME);
    await page.type('input[name="password"]', INSTAGRAM_PASSWORD);
    await page.click('button[type="submit"]');
    await delay(3000);

    if (await page.$('input[name="username"]')) {
      throw new Error('Login failed');
    }

    socket.emit('update', 'Successfully logged in');

    const users = await getUserList(page, username, extractType, maxAccounts);
    if (!users.length) {
      throw new Error(`No ${extractType} found or unable to access list`);
    }

    socket.emit('update', `Found ${users.length} ${extractType} to process`);

    for (const user of users) {
      if (stopProcess) {
        socket.emit('update', 'Process stopped by user');
        break;
      }

      try {
        await page.goto('https://www.instagram.com/direct/new/');
        await delay(1500);

        await page.type('input[placeholder="Search..."]', user);
        await delay(1500);

        const userOption = await page.$(`div:has-text("${user}")`);
        if (!userOption) throw new Error(`Could not find user ${user}`);
        await userOption.click();
        await delay(1000);

        await page.click('button:has-text("Next")');
        await delay(1500);

        await page.type('textarea[placeholder="Message..."]', message);
        await delay(1000);

        await page.click('button:has-text("Send")');
        processedCount++;

        socket.emit('update', `✓ Message sent to ${user} (${processedCount}/${users.length})`);
        await delay(delayBetweenMsgs * 1000);
      } catch (error) {
        socket.emit('update', `× Failed to message ${user}: ${error.message}`);
        await delay(1000);
      }
    }
  } catch (error) {
    socket.emit('update', `Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    socket.emit('update', `Process completed. Successfully sent ${processedCount} messages.`);
    stopProcess = false;
  }
}

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('start_process', (data: InstagramAutomation) => {
    stopProcess = false;
    sendMassDM(socket, data);
  });

  socket.on('stop_process', () => {
    stopProcess = true;
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
