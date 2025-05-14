const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function sleep(delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, delay * 1000)
    })
}

async function humanize(textToType) {
    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--incognito", "--no-sandbox"],
            defaultViewport: {
                width: 1280,
                height: 720
            },
            executablePath: "/usr/bin/chromium"
        });

        const context = await browser.createBrowserContext();
        // console.log("Incognito: " + context.isIncognito());

        const page = await context.newPage();

        await page.goto("https://www.humanizeai.pro/", {
            waitUntil: "networkidle0",
            timeout: 60 * 1000
        });

        await page.waitForSelector("textarea[data-track='input_textarea']")
        await page.type("textarea[data-track='input_textarea']", textToType)

        await page.waitForSelector("button[data-track='paraphrase_button']")
        await page.click("button[data-track='paraphrase_button']")

        await sleep(35)
        const text = await page.evaluate(() => {
            const element = document.querySelector(`div[class *='OutputContainer_output']`)
            return element.innerText
        })

        return text.slice(0, text.indexOf("added change"))
    } catch (err) {
        console.error("Error humanizing text:", err.message)
        return textToType
    }
}

module.exports = {
    humanize
}