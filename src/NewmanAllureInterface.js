const randomUUID = require('uuid').v4
const Allure = require('allure-js-commons').Allure
const isPromise = require('allure-js-commons').isPromise
const WrappedStep = require('./WrappedStep')
var PDFImage = require('pdf-image').PDFImage
const fs = require('fs')

class NewmanAllureInterface extends Allure {
  constructor(reporter, runtime) {
    super(runtime)
    this.reporter = reporter
  }

  label(name, value) {
    try {
      this.reporter.currentTest.addLabel(name, value)
    } catch (_a) {
      this.reporter.addLabel(name, value)
    }
  }
  step(name, body) {
    const WrappedStep = this.startStep(name)
    let result
    try {
      result = WrappedStep.run(body)
    } catch (err) {
      WrappedStep.endStep()
      throw err
    }
    if (isPromise(result)) {
      const promise = result
      return promise
        .then(a => {
          WrappedStep.endStep()
          return a
        })
        .catch(e => {
          WrappedStep.endStep()
          throw e
        })
    }
    WrappedStep.endStep()
    return result
  }

  setDescription(description) {
    this.currentExecutable.description = description
  }
  setDescriptionHtml(html) {
    this.currentExecutable.descriptionHtml = html
  }

  logStep(name, status) {
    this.step(name, () => {}) // todo status
  }

  attachment(name, content, type) {
    const file = this.reporter.writeAttachment(content, type)
    this.currentExecutable.addAttachment(name, type, file)
  }

  async convertPdfToPng(content, fileName) {
    const path = `${this.reporter.resultsDir}/${fileName}`

    try {
      await fs.writeFile(`${path}.pdf`, content, () => Promise.resolve())

      var pdfImage = new PDFImage(`${path}.pdf`, {
        combinedImage: true,
        graphicsMagick: true,
        '-quality': '100'
      })

      await pdfImage.convertFile()
    } catch (error) {
      console.log(error)
    }
  }

  createAttachmentFile(type, content) {
    var file = ''

    if (type === 'application/json') {
      try {
        content = content.toString()
        content = this.reporter.escape(content)

        content =
          content.includes(`":`) && !content.includes(' {{')
            ? JSON.parse(content)
            : content
        content = JSON.stringify(content, undefined, 2)
      } catch (error) {
        console.log(error)
      }
    }

    if (type === 'multipart/form-data') {
      type = 'application/json'
      try {
        content = content.PostmanPropertyList
          ? content.PostmanPropertyList.members
          : content
        content = JSON.stringify(content)
      } catch (error) {
        console.log(error)
      }
    }

    if (type === 'application/pdf') {
      const fileName = `${randomUUID()}-attachment`
      this.convertPdfToPng(content, fileName)
      file = `${fileName}.png`
      type = 'image/png'
    }

    if (type === 'text/html') {
      content = content.toString()
      type = 'text/plain'
    }

    if (file === '') {
      file = this.reporter.writeAttachment(content, type || 'text/plain')
    }

    return { type, file }
  }

  testAttachment(rawType, rawContent, name) {
    var { type, file } = this.createAttachmentFile(rawType, rawContent)

    try {
      this.currentTest.addAttachment(name, type, file)
    } catch (error) {
      console.log(error)
    }
  }

  addEnvironment(name, value) {
    this.currentTest.addParameter('environment-variable', name, value)
    return this
  }

  addParameter(name, value) {
    this.currentTest.addParameter(name, value)
    return this
  }

  setHistoryId(id) {
    this.currentTest.historyId = id
    return this
  }

  startStep(name) {
    const allureStep = this.currentExecutable.startStep(name)
    this.reporter.pushStep(allureStep)
    return new WrappedStep(this.reporter, allureStep)
  }

  endThisStep(status) {
    const curStep = this.reporter.popStep()
    curStep.endStep(status)
  }

  get currentTest() {
    if (this.reporter.currentTest === null) {
      throw new Error('No test running!')
    }
    return this.reporter.currentTest
  }
  get currentExecutable() {
    const executable = this.reporter.currentStep || this.reporter.currentTest
    if (executable === null) {
      throw new Error('No executable!')
    }
    return executable
  }
}

module.exports = NewmanAllureInterface
