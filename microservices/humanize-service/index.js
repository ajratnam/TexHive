const express = require("express")
require("dotenv").config()
const { humanize } = require("./humanize.js")

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8003
app.listen(PORT, () => {
    console.log(`Listening on port: ${PORT}`)
})

app.get("/", (req, res) => {
    res.send({
        message: "Welcome to the Text Humanizer Service!"
    })
})

app.post("/humanize", async (req, res) =>{
    let status = 500
    try {
        const text = req.body.text;
        console.log(`Text: ${text}`)
        
        if(text.split(/\s+/).length < 30) {
            status = 400;
            throw new Error("Please enter atleast 30 words.")
        }

        const humanizedText = await humanize(text)
        console.log(`Humanized Text: ${humanizedText}`)
        status = 200

        res.status(status).send({
            success: true,
            humanized_text: humanizedText
        })
    } catch(err) {
        res.status(status).send({
            success: false,
            error: err.message
        })
    }
})