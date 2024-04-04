const puppeteer = require('puppeteer');
const logger = require('./api/logging/logger');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
// const {query} = require("winston");
// Set up the server port
const port = process.env.PORT || 3002;

let htmltest = "https://main--edgeservices--ddttom.hlx.page/complexindex";
let sitemapURL = "https://main--edgeservices--ddttom.hlx.page/query-index.json";
let baseURL='';
let results="";
let test='html';
let prompt = '';
if (test==='html') {
    prompt = '/readHTML?path=' + htmltest;
} else {
    prompt = '/sitemap?path="' + sitemapURL;
}
const serverprompt = `<h1>Welcome to the HTML Creator service.</h1><a href="${prompt}">Click here to start</a>`;
async function handlesitemap(queryValue, res) {
    const newURL = new URL(queryValue);
    const host = newURL.host;
    await processSitemap(host);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(results);
    res.end("<br>done");
}

async function handlehtml(queryValue, res) {
    try {
        await scrape(queryValue+"?skipdebug=true");
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(results);
        res.end("done");

    } catch (error) {
        messaging(`Scraping error: ${error}`);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({message: 'Internal Server Error'}));
    }
}

// Create the HTTP server
http.createServer(async (req, res) => {
    baseURL = `https://${req.headers.host}/`;
    const myURL = new URL(req.url, baseURL);
    let queryValue = myURL.searchParams.get('path');

    let task= req.url.split('?')[0];
    switch (task) {
        case '/':
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(serverprompt);
            break;
        case '/sitemap':
            await handlesitemap(queryValue, res);
            break;
        case '/readHTML':
            await handlehtml(queryValue, res);
            break;
        default:
            res.writeHead(404, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({message: 'Resource not found'}));
    }
}).listen(port, () => {
    console.log(`Server running on http://localhost:${port}${prompt}`);
});

function fixup(content) {

    let contentArray = content.split('\n');
    for (let i = 0; i < contentArray.length; i++) {
        contentArray[i] = contentArray[i].trimRight();
    }
    content = contentArray.join('\n');
    content = content.replaceAll('><head','>\n  <head');
    content = content.replaceAll('></head','>\n</head');
    content = content.replaceAll('></footer','>\n</footer');


    content=content.replaceAll('">{', '">\n{');
    content=content.replaceAll('}</', '}\n</');
    content=content.replaceAll('><meta', '>\n<meta');
    content=content.replaceAll('><link', '>\n<link');
    content=content.replaceAll('><script', '>\n<script');
    content=content.replaceAll('><style', '>\n<style');
    content=content.replaceAll('<footer></footer>','');
    content=content.replaceAll('<header></header>','');
    while (content.includes(' \n')) {
        content = content.replaceAll(' \n', '\n');
    }
    while (content.includes('\n\n')) {
        content = content.replaceAll('\n\n', '\n');
    }
    return content;
}
async function processSitemap(host) {
    try {
        const sitemap = await fetchJson(sitemapURL);
        if (sitemap.data && Array.isArray(sitemap.data)) {
            for (const item of sitemap.data) {
                try {
                    if (!item.path.startsWith('/tools')) {
                            await scrape("https://" + host + item.path + "?skipdebug=true");
                            messaging(`Extraction successful for ${item.path}`);
                    }
                } catch (error) {
                    messaging(`Error extracting ${item.path}: ${error}`);
                }
            }
        } else {
            messaging('Invalid sitemap structure: missing or invalid "data" property');
        }
    } catch (error) {
        messaging(`Failed to fetch or process sitemap: ${error}`);
    }
}
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (e) {
                    reject(`Error parsing JSON: ${e}`);
                }
            });
        }).on('error', (e) => {
            reject(`HTTP request failed: ${e}`);
        });
    });
}

async function scrape(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    await browser.close();

    const filePath = `${os.homedir()}/scrape${getPathname(url)}.html`;
    return new Promise((resolve, reject) => {
        const fixedcontent = fixup(content);
        createPathIfNotExist(filePath);
        fs.writeFile(filePath, fixedcontent, err => {
            if (err) {
                const error =`Error writing file: ${err}`;
                messaging(error);
                reject(err);
            } else {
                const message=`Saved DOM content to ${filePath}`
                messaging(message);
                resolve(content); // Resolve with content instead of file path
            }
        });
    });
}

function createPathIfNotExist(filePath) {
    const dirName = path.dirname(filePath);

    fs.mkdirSync(dirName, { recursive: true }, (err) => {
        if (err) {
            if (err.code !== 'EEXIST') { // Ignore error if directory already exists
                messaging('Error creating directory:', err);
            }
        } else {
            messaging(`Directory created: ${dirName}`);
        }
    });
}
// Function to extract the last part of the path without the extension
function getPathname(urlString) {
    const parsedUrl = new URL(urlString);
    return parsedUrl.pathname;
}

function messaging(message) {
    logger.info(message);
    console.log(message);
    results+='<br>'+message;
}
