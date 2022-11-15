const express = require("express")
const fileUpload = require("express-fileupload")
const tesseract = require("tesseract.js")
const jimp = require("jimp")
const app = express()
const nikParser = require("nik-parser")
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

let parserImageKtp = async (sampleFile, additionThreshold, fileName) => {
  const image = await jimp.read(sampleFile)
  // image.resize(1500, 767)
  image.crop(300, 180, 730, 500)
  // image.gaussian(1)
  console.log("====", 50 + additionThreshold)
  image.threshold({ max: 70 + additionThreshold })
  // image.write(fileName)
  let resultDataBuffer = await image.getBufferAsync(jimp.MIME_PNG)
  const arrayUint = new Uint8ClampedArray(resultDataBuffer)
  return {
    dataBuffer: resultDataBuffer,
    arrayUint: arrayUint.length,
  }
}

let parserNikKtp = async (sampleFile, additionThreshold, fileName) => {
  const image = await jimp.read(sampleFile)
  // image.resize(1500, 767)
  image.crop(260, 110, 850, 95)
  // image.gaussian(1)
  console.log("====", 50 + additionThreshold)
  image.threshold({ max: 50 + additionThreshold })
  // image.write("ktpNik" + fileName)
  let resultDataBuffer = await image.getBufferAsync(jimp.MIME_PNG)
  const arrayUint = new Uint8ClampedArray(resultDataBuffer)
  return {
    dataBuffer: resultDataBuffer,
    arrayUint: arrayUint.length,
  }
}

let middleware = async (req, res, next) => {
  const sampleFile = req.files?.sampleFile
  if (!sampleFile) return res.status(400).send("No files were uploaded.")
  try {
    var fileExt = sampleFile.name.split(".").pop()
    let fileName = "ktp." + fileExt
    const image = await jimp.read(sampleFile.data)
    image.resize(1500, 767)
    let bufferResize = await image.getBufferAsync(jimp.MIME_PNG)
    const arrKtp = new Uint8ClampedArray(bufferResize)
    console.log("AAAAAAA", arrKtp.length)

    // const image = await jimp.read(sampleFile.data)
    // image.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    // image.crop(300, 180, 730, 500)
    // // image.gaussian(1)
    // image.threshold({ max: 100 })
    // let resultDataBuffer = await image.getBufferAsync(jimp.MIME_PNG)
    // const arrayUint = new Uint8ClampedArray(resultDataBuffer)
    // console.log("PPOPOPOPO", arrayUint)
    // // image.write(fileName)

    // console.time("time nik")
    // const imageNik = await jimp.read(bufferResize)
    // // imageNik.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    // // imageNik.crop(260, 110, 785, 95)
    // imageNik.crop(260, 110, 850, 95)
    // imageNik.gaussian(1)
    // imageNik.threshold({ max: 110 })
    // let resultDataBufferNik = await imageNik.getBufferAsync(jimp.MIME_PNG)
    // const arrayUintNIK = new Uint8ClampedArray(resultDataBufferNik)
    // console.log("arrayUintNIK", arrayUintNIK.length)
    // imageNik.write("ktpNik." + fileExt)
    // console.timeEnd("time nik")

    const imageHeader = await jimp.read(sampleFile.data)
    imageHeader.resize(1500 || image.bitmap.width, 767 || image.bitmap.height)
    imageHeader.crop(350, 0, 825, 120)
    imageHeader.gaussian(1)
    imageHeader.threshold({ max: 120 })
    let resultDataBufferHeader = await imageHeader.getBufferAsync(jimp.MIME_PNG)
    // imageHeader.write("ktpHeader." + fileExt)

    /* LOOP */
    // let DEFAULT_MAX_UINT_LENGTH = 92000
    // let DEFAULT_MIN_UINT_LENGTH = 89000

    let additionThreshold = 0
    let arrayUintLength = 0
    let resultDataBuffer = null
    // let DEFAULT_MAX_UINT_LENGTH = 130049
    // let DEFAULT_MIN_UINT_LENGTH = 125049

    let DEFAULT_MAX_UINT_LENGTH = 0
    let DEFAULT_MIN_UINT_LENGTH = 0

    if (arrKtp.length <= 1400000) {
      DEFAULT_MAX_UINT_LENGTH = 130049
      DEFAULT_MIN_UINT_LENGTH = 125049
    } else {
      DEFAULT_MAX_UINT_LENGTH = 98000
      DEFAULT_MIN_UINT_LENGTH = 89000
    }
    console.time("do while ktp")
    do {
      let temp = await parserImageKtp(bufferResize, additionThreshold, fileName)

      resultDataBuffer = temp.dataBuffer
      arrayUintLength = temp.arrayUint

      console.log(arrayUintLength)
      if (arrayUintLength > DEFAULT_MAX_UINT_LENGTH) {
        additionThreshold -= 5
      } else {
        additionThreshold += 8
      }
    } while (
      !(
        arrayUintLength > DEFAULT_MIN_UINT_LENGTH &&
        arrayUintLength < DEFAULT_MAX_UINT_LENGTH
      )
    )

    console.timeEnd("do while ktp")

    let additionThresholdNik = 0
    let resultDataBufferNik = null
    let arrayUintLengthNik = 0
    let DEFAULT_MAX_UINT_LENGTH_NIK = 25000
    let DEFAULT_MIN_UINT_LENGTH_NIK = 20000
    // let DEFAULT_MAX_UINT_LENGTH_NIK = 16736
    // let DEFAULT_MIN_UINT_LENGTH_NIK = 15647 //---
    console.time("do while nik")
    do {
      let tempnik = await parserNikKtp(
        bufferResize,
        additionThresholdNik,
        fileName
      )
      resultDataBufferNik = tempnik.dataBuffer
      arrayUintLengthNik = tempnik.arrayUint

      console.log(arrayUintLengthNik, "====nik")
      if (arrayUintLengthNik > DEFAULT_MAX_UINT_LENGTH_NIK) {
        additionThresholdNik -= 5
      } else {
        additionThresholdNik += 5
      }
    } while (
      !(
        arrayUintLengthNik > DEFAULT_MIN_UINT_LENGTH_NIK &&
        arrayUintLengthNik < DEFAULT_MAX_UINT_LENGTH_NIK
      )
    )
    console.timeEnd("do while nik")

    req.files.sampleFile.data = resultDataBuffer
    req.files.sampleFile.dataNik = resultDataBufferNik
    req.files.sampleFile.dataHeader = resultDataBufferHeader

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
    logger.info("Prosesing Ocr . . .")

    console.time("worker load")
    await worker.load()
    await workerNik.load()
    await workerHeader.load()
    console.timeEnd("worker load")

    console.time("initilize")

    await worker.loadLanguage("ind")
    // await worker.initialize("ind+lat")

    await workerNik.loadLanguage("ocr")
    // await workerNik.initialize("ocr")

    await workerHeader.loadLanguage("ind")
    // await workerHeader.initialize("ind+lat")

    // await workerNik.setParameters({ tessedit_char_whitelist: "1234567890" })
    // await worker.setParameters({
    //   tessedit_char_whitelist:
    //     "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
    // })
    // await workerHeader.setParameters({
    //   tessedit_char_whitelist:
    //     "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
    // })
    await Promise.all([
      worker.initialize("ind"),
      workerNik.initialize("ocr"),
      workerHeader.initialize("ind"),
    ])

    await Promise.all([
      workerNik.setParameters({ tessedit_char_whitelist: "1234567890" }),
      workerHeader.setParameters({
        tessedit_char_whitelist:
          "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
      }),
      worker.setParameters({
        tessedit_char_whitelist:
          "abcdefghijklmnopqrstuvwxyaABCDEFGHIJKLMNOPQRSTUVWXYA1234567890:- ",
      }),
    ])
    console.timeEnd("initilize")

    console.time("promise all")
    let promiseData = await Promise.all([
      worker.recognize(sampleFile.data),
      workerNik.recognize(sampleFile.dataNik),
      workerHeader.recognize(sampleFile.dataHeader),
    ])
    console.timeEnd("promise all")

    let { data } = promiseData[0]
    let { data: dataNik } = promiseData[1]
    let dataHeader = promiseData[2]
    // console.log(data)
    console.log(dataHeader.data.text)

    let arr = data.text.split("\n")
    arr = arr.filter((item) => item)
    console.log(arr)
    let obj = {}
    let nik = dataNik.text.replace(/[^0-9. ]/g, "").split(" ")
    console.log("[NIK]", nik)
    let resultNik = ""
    for (const item of nik) {
      if (item.length === 16) {
        resultNik = item
        break
      } else if (item.length > 16) {
        let temp = item.split("")
        temp.shift()
        resultNik = temp.join("")
      } else if (item.length >= 3) {
        resultNik += item
      }
    }
    obj.nik = resultNik

    let translateNik = nikParser.nikParser(resultNik)

    if (arr.length < 12) {
      return res.status(400).send({
        message: "IMAGE_INVALID",
      })
    }

    console.time("prosesing data json")
    // if (arr.length > 12) arr.shift()
    let nameSec = arr?.[1].split("")
    let check = nameSec.some((item) => item.match(/^[0-9]+/g))
    if (!check) {
      arr[0] += " " + arr[1]
      arr.splice(1, 1)
    }
    arr.forEach((item, idx) => {
      item = item.replaceAll(":", "")

      if (idx === 0) {
        item = item.replace(2, "Z")
        item = item.replace(7, "Z")
        item = item.replace(5, "S")
        let temp = item.replace(/[^A-Z ]/g, "").split(" ")
        temp = temp.filter((item) => item.length > 2)
        obj.name = temp.join(" ")
      }

      if (idx === 1) {
        let splitedArr = item.split(" ").filter((item) => (item ? true : false))
        let birthPlace = ""
        splitedArr.forEach((item) => {
          if (item.match(/^[A-Z ]{4,}$/g)) {
            birthPlace += " " + item
          } else if (item.match(/^[A-Z ]{2,}$/g)) {
            birthPlace += item
          }
        })
        obj.birthPlace = birthPlace

        let numberOnly = item.replace(/[^0-9.]/g, "").split("")
        let birthDate = ""
        numberOnly.forEach((number, idx) => {
          if (idx === 2 || idx === 4) birthDate += "-"
          birthDate += number
        })
        obj.birthDate = birthDate
      }

      if (idx === 2) {
        let check =
          item.toLocaleLowerCase().includes("aki") ||
          item.toLocaleLowerCase().includes("lak")
        obj.gender = check ? "LAKI - LAKI" : "PEREMPUAN"
      }

      if (idx === 3) {
        let alphaOnly = item.replace(/[^A-Z0-9 ]/g, "")
        obj.address = alphaOnly
      }

      if (idx === 4) {
        item = item.replaceAll("O", 0)
        let numberOnly = item.replace(/[^0-9.]/g, "")
        obj.rt = numberOnly.slice(0, 3)
        obj.rw = numberOnly.slice(-3)
      }

      if ([5, 6, 7, 8, 9, 10].includes(idx)) {
        let mapKey = {
          5: "subDistrict",
          6: "districts",
          7: "religion",
          8: "maritalStatus",
          9: "job",
          10: "nationality",
        }
        let splittedString = item
          .split(" ")
          .filter((item) => (item ? true : false))
        let result = ""
        splittedString.some((item) => {
          let resultFill = item.replace(/[^A-Z/]/g, "")
          if ([7].includes(idx)) {
            if (resultFill.includes("LAM")) {
              result = "ISLAM"
              return true
            } else if (resultFill.includes("TEN")) {
              result = "KRISTEN"
              return true
            } else if (resultFill.includes("THO")) {
              result = "KATHOLIK"
              return true
            } else {
              result += resultFill
            }
          } else if ([8].includes(idx)) {
            if (resultFill.includes("LUM")) {
              result = "BELUM KAWIN"
              return true
            } else {
              result = "KAWIN"
              return true
            }
          } else if ([10].includes(idx)) {
            if (resultFill.includes("NI")) {
              result = "WNI"
            } else {
              result += resultFill
            }
          } else {
            if (resultFill.length > 1) {
              result += " " + resultFill
            }
          }
        })
        obj[mapKey[idx]] = result.replaceAll("undefined", "")
      }
    })
    console.timeEnd("prosesing data json")
    await worker.terminate()
    await workerNik.terminate()
    await workerHeader.terminate()
    // fs.unlinkSync(fileName)
    logger.warn("Sukses")
    let responseJson = {
      dataOcrKtp: obj,
    }
    // console.log(translateNik)
    if (translateNik.isValid()) {
      responseJson.dataNikParser = {
        province: translateNik.province(),
        city: translateNik.kabupatenKota(),
        district: translateNik.kecamatan(),
        zipCode: translateNik.kodepos(),
        gender: resultNik.substring(6, 8) > 40 ? "PEREMPUAN" : "LAKI - LAKI",
        lahir: translateNik.lahir(),
      }
    }
    res.status(200).send(responseJson)
  } catch (error) {
    console.log(error)
    throw error
  }
})

app.listen(process.env.PORT || 4500, () => {
  console.log("======================")
  console.log("jalan di port 4500")
  console.log("====================")
})
