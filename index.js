const express = require("express")
const fileUpload = require("express-fileupload")
const path = require("path")
const tesseract = require("tesseract.js")
const jimp = require("jimp")
const fs = require("fs")
const app = express()

app.use(fileUpload())

app.get("/", (_, res) => {
  res.send(`
    <form action='/upload' method='post' encType="multipart/form-data">
      <input type="file" name="sampleFile" />
      <input type='submit' value='Upload!' />
    </form>`)
})

let middleware = async (req, res, next) => {
  const sampleFile = req.files?.sampleFile
  if (!sampleFile) return res.status(400).send("No files were uploaded.")
  try {
    var fileExt = sampleFile.name.split(".").pop()
    let fileName = "ktp." + fileExt
    const image = await jimp.read(sampleFile.data)
    const imageNik = await jimp.read(sampleFile.data)

    image.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    imageNik.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)

    image.crop(300, 180, 730, 500)
    imageNik.crop(260, 110, 770, 95)

    imageNik.gaussian(1)

    image.threshold({ max: 120 })
    imageNik.threshold({ max: 120 })

    let resultDataBuffer = await image.getBufferAsync(jimp.MIME_PNG)
    let resultDataBufferNik = await imageNik.getBufferAsync(jimp.MIME_PNG)

    req.files.sampleFile.data = resultDataBuffer
    req.files.sampleFile.dataNik = resultDataBufferNik

    /* CREATE IMAGE */
    // image.write(fileName)
    // imageNik.write("ktpNik." + fileExt)

    next()
  } catch (error) {
    console.log("[MIDDLEWARE]", error)
  }
}
app.post("/upload", middleware, async (req, res) => {
  const { sampleFile } = req.files
  if (!sampleFile) return res.status(400).send("No files were uploaded.")
  try {
    const worker = tesseract.createWorker({})
    const workerNik = tesseract.createWorker({})
    console.log("Proses OCR .....")
    await worker.load()
    await workerNik.load()

    await worker.loadLanguage("ind")
    await worker.initialize("ind")

    await workerNik.loadLanguage("ocr")
    await workerNik.initialize("ocr")

    await workerNik.setParameters({ tessedit_char_whitelist: "1234567890" })
    await worker.setParameters({
      tessedit_char_whitelist:
        "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
    })

    const { data } = await worker.recognize(sampleFile.data)
    const { data: dataNik } = await workerNik.recognize(sampleFile.dataNik)
    let arr = data.text.split("\n")
    arr = arr.filter((item) => item)

    let obj = {}
    let nik = dataNik.text.replace(/[^0-9. ]/g, "").split(" ")
    let resultNik = nik[1] || nik[0]
    if (nik?.[2]?.length >= 2) {
      resultNik += nik[2]
    }
    obj.nik = resultNik
    if (arr.length < 12) {
      return res.status(400).send({
        message: "IMAGE_INVALID",
      })
    }
    if (arr.length !== 12) arr.shift()
    arr.forEach((item, idx) => {
      item = item.replaceAll(":", "")
      if (idx === 0) obj.name = item.replace(/[^a-zA-Z ]/g, "")
      if (idx === 1) {
        let splitedArr = item.split(" ").filter((item) => (item ? true : false))
        obj.birthPlace = splitedArr[1]
        let numberOnly = item.replace(/[^0-9.]/g, "").split("")
        let birthDate = ""
        numberOnly.forEach((number, idx) => {
          if (idx === 2 || idx === 4) birthDate += "-"
          birthDate += number
        })
        obj.birthDate = birthDate
      }
      if (idx === 2) {
        let check = item.toLocaleLowerCase().includes("laki")
        obj.gender = check ? "LAKI - LAKI" : "PEREMPUAN"
      }
      if (idx === 3) {
        let alphaOnly = item.replace(/[^a-zA-Z ]/g, "")
        obj.address = item || alphaOnly
      }
      if (idx === 4) {
        let numberOnly = item.replace(/[^0-9.]/g, "")
        obj.rt = numberOnly.slice(0, 3)
        obj.rw = numberOnly.slice(-3)
      }
      if ([5, 6, 7, 8, 9, 10].includes(idx)) {
        let mapKey = {
          5: "districts",
          6: "subDistrict",
          7: "religion",
          8: "maritalStatus",
          9: "job",
          10: "nationality",
        }
        let splittedString = item
          .split(" ")
          .filter((item) => (item ? true : false))
        if ([0, 1].includes(splittedString.length)) {
          obj[mapKey[idx]] = item
        } else {
          let value
          if ([5, 6].includes(idx)) {
            value =
              splittedString[0].length >= 4
                ? splittedString[0]
                : splittedString[1]
            if (splittedString?.[1]?.length >= 4 && value !== splittedString[1])
              value += " " + splittedString[1]
          } else {
            value =
              splittedString[1].length >= 3
                ? splittedString[1]
                : splittedString[0]
            if (splittedString?.[2]?.length >= 4)
              value += " " + splittedString[2]
          }
          obj[mapKey[idx]] = value
        }
      }
    })
    await worker.terminate()
    await workerNik.terminate()

    console.log("==== Ekstrack Sukses ====")
    res.status(200).send(obj)
  } catch (error) {
    throw error
  }
})

app.listen(process.env.PORT || 3000, () => {
  console.log("======================")
  console.log("jalan di port 3000")
  console.log("====================")
})
