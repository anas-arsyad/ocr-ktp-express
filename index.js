const express = require("express")
const fileUpload = require("express-fileupload")
const tesseract = require("tesseract.js")
const jimp = require("jimp")
const app = express()
const nikParser=require('nik-parser')
const logger = require("./utils/logger")
const morganMiddleware = require("./utils/morganMiddleware")

app.use(fileUpload())
app.use(morganMiddleware)
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
    const imageHeader = await jimp.read(sampleFile.data)

    image.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    imageNik.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    imageHeader.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)

    image.crop(300, 180, 730, 500)
    imageNik.crop(260, 110, 785, 95)
    imageHeader.crop(350, 0, 825, 120)

    // await image.gaussian(1)
    imageNik.gaussian(1)
    imageHeader.gaussian(1)

    // await imageNik.invert()
    // await image.invert()

    // await image.color([
    // {apply: 'desaturate', params: [100]},
    // { apply: "lighten", params: [2] },
    // { apply: "brighten", params: [0] },
    // ])

    image.threshold({ max: 120 })
    imageNik.threshold({ max: 120 })
    imageHeader.threshold({ max: 120 })

    let resultDataBuffer = await image.getBufferAsync(jimp.MIME_PNG)
    let resultDataBufferNik = await imageNik.getBufferAsync(jimp.MIME_PNG)
    let resultDataBufferHeader = await imageHeader.getBufferAsync(jimp.MIME_PNG)

    req.files.sampleFile.data = resultDataBuffer
    req.files.sampleFile.dataNik = resultDataBufferNik
    req.files.sampleFile.dataHeader = resultDataBufferHeader

    image.write(fileName)
    imageNik.write("ktpNik." + fileExt)
    imageHeader.write("ktpHeader." + fileExt)
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
    const workerHeader = tesseract.createWorker({})
    logger.info('Prosesing Ocr . . .')
    await worker.load()
    await workerNik.load()
    await workerHeader.load()

    await worker.loadLanguage("ind+lat")
    await worker.initialize("ind+lat")

    await workerNik.loadLanguage("ocr")
    await workerNik.initialize("ocr")

    await workerHeader.loadLanguage("ind+lat")
    await workerHeader.initialize("ind+lat")

    await workerNik.setParameters({ tessedit_char_whitelist: "1234567890" })
    await worker.setParameters({
      tessedit_char_whitelist:
        "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
    })
    await workerHeader.setParameters({
      tessedit_char_whitelist:
        "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
    })

    const { data } = await worker.recognize(sampleFile.data)
    const { data: dataNik } = await workerNik.recognize(sampleFile.dataNik)
    const { data: dataHeader } = await workerHeader.recognize(
      sampleFile.dataHeader
    )

    console.log(dataHeader.text)

    let arr = data.text.split("\n")
    arr = arr.filter((item) => item)
    console.log(arr)
    console.log("[NIK]", dataNik.text)
    let obj = {}
    let nik = dataNik.text.replace(/[^0-9. ]/g, "").split(" ")
    let resultNik = nik[1] || nik[0]
    if (nik?.[2]?.length >= 2) {
      resultNik += nik[2]
    }
    obj.nik = resultNik

    let translateNik = nikParser.nikParser(resultNik)

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
        obj.birthPlace = splitedArr[1].match(/^[a-zA-Z ]{3,}$/g)
          ? splitedArr[1]
          : splitedArr[0]
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
    await workerHeader.terminate()
    // fs.unlinkSync(fileName)
    logger.warn('Sukses')
    let responseJson = {
      dataOcrKtp: obj,
      dataNikParser: {
        district: translateNik.province(),
        city: translateNik.kabupatenKota(),
        subDistrict: translateNik.kecamatan(),
        zipCode: translateNik.kodepos(),
        gender: translateNik.kelamin(),
        lahir: translateNik.lahir(),
      },
    }
    res.status(200).send(responseJson)
  } catch (error) {
    throw error
  }
})

app.listen(process.env.PORT || 3000, () => {
  console.log("======================")
  console.log("jalan di port 3000")
  console.log("====================")
})
