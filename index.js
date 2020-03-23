const AllureRuntime = require('allure-js-commons').AllureRuntime
const isPromise = require('allure-js-commons').isPromise
const Status = require('allure-js-commons').Status
const LabelName = require('allure-js-commons').LabelName
const Stage = require('allure-js-commons').Allure
const NewmanAllureInterface = require('./src/NewmanAllureInterface')
const createHash = require('crypto').createHash
const _ = require('lodash')

class AllureReporter {
  constructor(emitter, reporterOptions, options) {
    this.suites = []
    this.steps = []
    this.runningTest = null
    this.currentNMGroup = options.collection
    this.resultsDir = reporterOptions.export || 'allure-results'
    var config = {
      resultsDir: this.resultsDir
    }
    this.runtime = new AllureRuntime(config)
    this.reporterOptions = reporterOptions
    this.options = options
    const events = 'start beforeIteration iteration beforeItem item beforePrerequest prerequest beforeScript script beforeRequest request beforeTest test beforeAssertion assertion console exception beforeDone done'.split(
      ' '
    )
    events.forEach(e => {
      if (typeof this[e] == 'function')
        emitter.on(e, (err, args) => this[e](err, args))
    })
    this.prevRunningTest = ''
    this.testCounter = 1
    this.pre_req_script = ''
    this.test_script = ''
  }

  getInterface() {
    return new NewmanAllureInterface(this, this.runtime)
  }

  get currentSuite() {
    if (this.suites.length === 0) {
      return null
    }
    return this.suites[this.suites.length - 1]
  }

  get currentStep() {
    if (this.steps.length > 0) return this.steps[this.steps.length - 1]
    return null
  }

  get currentTest() {
    if (this.runningTest === null) throw new Error('No active test')
    return this.runningTest
  }

  set currentTest(test) {
    this.runningTest = test
  }

  writeAttachment(content, type) {
    try {
      return this.runtime.writeAttachment(content, type)
    } catch (error) {
      console.log(error)
    }
  }

  pushSuite(suite) {
    this.suites.push(suite)
  }

  popSuite() {
    this.suites.pop()
  }

  start(err, args) {
    const suiteName = this.options.collection.name
    console.log(`### Starting Execution For - ${suiteName} ###`)
    const scope = this.currentSuite || this.runtime
    const suite = scope.startGroup(suiteName || 'Global')
    this.pushSuite(suite)
  }

  prerequest(err, args) {
    if (
      args.executions != undefined &&
      _.isArray(args.executions) &&
      args.executions.length > 1
    )
      this.pre_req_script = args.executions[1].script.exec.join('\n')
  }

  test(err, args) {
    if (
      args.executions != undefined &&
      _.isArray(args.executions) &&
      args.executions.length > 1
    )
      this.test_script = args.executions[1].script.exec.join('\n')
  }

  console(err, args) {
    if (err) {
      return
    }
    if (args.level) {
      this.consoleLogs = this.consoleLogs || []
      this.consoleLogs.push(`level: ${args.level}, messages: ${args.messages}`)
    }
  }

  request(err, args) {
    if (err) return

    const req = args.request

    let url = req.url.protocol + '://' + req.url.host.join('.')

    this.currentTest.addLabel(LabelName.HOST, url)

    if (req.url.path !== undefined) {
      if (req.url.path.length > 0) {
        url = url + '/' + req.url.path.join('/')
      }
    }

    const req_content_type_header = req.headers.find(
      o => o.key === 'Content-Type'
    )

    let reqType = ''
    if (req_content_type_header) {
      const req_content_type = req_content_type_header.value
      if (req_content_type && typeof req_content_type === 'string') {
        reqType = req_content_type.split(';')[0]
      }
    }

    this.requestData = {
      url: url,
      method: req.method,
      contentType: reqType,
      body: req.body
    }

    const resp = args.response
    const resp_stream = resp.stream
    const resp_body = Buffer.from(resp_stream)

    const resp_content_type_header = resp.headers.find(
      o => o.key === 'Content-Type'
    )

    let respType = ''
    if (resp_content_type_header) {
      const resp_content_type = resp_content_type_header.value
      if (resp_content_type && typeof resp_content_type === 'string') {
        respType = resp_content_type.split(';')[0]
      }
    }

    this.responseData = {
      status: resp.status,
      code: resp.code,
      contentType: respType,
      body: resp_body
    }
  }

  assertion(err, args) {
    const stepName = args.assertion
    const curStep = this.getInterface().startStep(stepName)

    if (err) {
      // console.log('\n\nassertion() err')
      // console.log(err)
      this.currItem.passed = false
      this.currItem.failedAssertions.push(args.assertion)
      curStep.endStep(Status.FAILED)
    } else {
      // console.log('\n\nassertion() passed')
      // console.log(args)
      curStep.endStep(Status.PASSED)
    }
  }

  done(err, args) {
    if (this.runningTest !== null) {
      console.error('Allure reporter issue: running test on suiteDone')
    }
    if (this.currentSuite !== null) {
      if (this.currentStep !== null) {
        this.currentStep.endStep()
      }
      this.currentSuite.endGroup()
      this.popSuite()
    }
    console.log(`#### Finished Execution ####`)
  }

  beforeItem(err, args) {
    this.currItem = {
      name: this.itemName(args.item, args.cursor),
      passed: true,
      failedAssertions: []
    }
    this.consoleLogs = []

    if (this.currentSuite === null) {
      throw new Error('No active suite')
    }

    var testName = this.currItem.name

    if (testName.indexOf('/') > 0) {
      const len = testName.split('/').length
      testName = testName.split('/')[len - 1]
    }

    let testFullName = ''
    if (this.prevRunningTest === testName) {
      this.testCounter++
      this.currentTest = this.currentSuite.startTest(
        testName + '_repeated_' + this.testCounter
      )
      testFullName = this.currItem.name + '_repeated_' + this.testCounter
    } else {
      this.testCounter = 1
      this.currentTest = this.currentSuite.startTest(testName)
      this.prevRunningTest = testName
      testFullName = this.currItem.name
    }

    this.currentTest.historyId = createHash('md5')
      .update(testFullName)
      .digest('hex')

    this.currentTest.stage = Stage.RUNNING

    var itemGroup = args.item.parent()

    var root = !itemGroup || itemGroup === this.options.collection
    var fullName = ''
    if (itemGroup && this.currentNMGroup !== itemGroup) {
      !root && (fullName = this.getFullName(itemGroup))
      this.currentNMGroup = itemGroup
    }

    fullName = this.getFullName(this.currentNMGroup)

    var parentSuite, suite
    var subSuites = []
    if (fullName !== '') {
      if (fullName.indexOf('/') > 0) {
        const numFolders = fullName.split('/').length
        if (numFolders > 0) {
          parentSuite = fullName.split('/')[0]
          if (numFolders > 1) suite = fullName.split('/')[1]
          if (numFolders > 2) subSuites = fullName.split('/').slice(2)
        }
      } else {
        parentSuite = fullName
      }
    }

    if (parentSuite !== undefined) {
      parentSuite = parentSuite.charAt(0).toUpperCase() + parentSuite.slice(1)
      this.currentTest.addLabel(LabelName.PARENT_SUITE, parentSuite)
      // this.currentTest.addLabel(LabelName.FEATURE, parentSuite)
    }
    if (suite !== undefined) {
      suite = suite.charAt(0).toUpperCase() + suite.slice(1)
      this.currentTest.addLabel(LabelName.SUITE, suite)
    }

    if (subSuites !== undefined) {
      if (subSuites.length > 0) {
        let captalizedSubSuites = []

        for (var i = 0; i < subSuites.length; i++) {
          captalizedSubSuites.push(
            subSuites[i].charAt(0).toUpperCase() + subSuites[i].slice(1)
          )
        }
        this.currentTest.addLabel(
          LabelName.SUB_SUITE,
          captalizedSubSuites.join(' > ')
        )
      }
    }

    let path
    if (args.item.request.url.path !== undefined) {
      if (args.item.request.url.path.length > 0) {
        path = args.item.request.url.path.join('/')
      }
    }

    if (path !== undefined) {
      this.currentTest.addLabel(LabelName.STORY, path)
    }
  }

  getFullName(item, separator) {
    if (
      _.isEmpty(item) ||
      !_.isFunction(item.parent) ||
      !_.isFunction(item.forEachParent)
    ) {
      return
    }
    var chain = []
    item.forEachParent(function(parent) {
      chain.unshift(parent.name || parent.id)
    })
    item.parent() && chain.push(item.name || item.id) // Add the current item only if it is not the collection
    return chain.join(_.isString(separator) ? separator : '/')
  }

  attachConsoleLogs() {
    if (this.consoleLogs.length > 0) {
      const buf = Buffer.from(this.consoleLogs.join('\n'), 'utf8')
      this.getInterface().testAttachment('text/plain', buf, 'ConsoleLogs')
    }
  }

  attachPrerequest(pre_req) {
    if (pre_req !== undefined) {
      const buf = Buffer.from(pre_req, 'utf8')
      this.getInterface().testAttachment('text/plain', buf, 'PreRequest')
    }
  }

  attachTestScript(test_script) {
    if (test_script !== undefined) {
      const buf = Buffer.from(test_script, 'utf8')
      this.getInterface().testAttachment('text/plain', buf, 'TestScript')
    }
  }

  attachRequest(request, type) {
    if (request !== undefined) {
      this.getInterface().testAttachment(type, request, 'Request')
    }
  }

  attachResponse(response, type) {
    if (response !== undefined) {
      this.getInterface().testAttachment(type, response, 'Response')
    }
  }

  setDescription(description) {
    if (description !== undefined) {
      this.getInterface().setDescription(description)
    }
  }

  setDescriptionHtml(html) {
    if (html !== undefined) {
      this.getInterface().setDescriptionHtml(html)
    }
  }

  pendingTestCase(test) {
    this.startCase(test)
    this.endTest(Status.SKIPPED, { message: 'Test ignored' })
  }

  passTestCase(test) {
    // console.log('\n\nPassed test:')
    // console.log(JSON.stringify(test))
    if (this.currentTest === null) {
      this.startCase(test)
    }
    this.endTest(Status.PASSED)
  }

  failTestCase(test, error) {
    // console.log('\n\nFailed test:')
    // console.log(JSON.stringify(test))
    // console.log('\nFailed error:')
    // console.log(JSON.stringify(error))

    if (this.currentTest === null) {
      this.startCase(test)
    } else {
      const latestStatus = this.currentTest.status
      // if test already has a failed state, we should not overwrite it
      if (latestStatus === Status.FAILED || latestStatus === Status.BROKEN) {
        return
      }
    }
    const status =
      error.name === 'AssertionError' ? Status.FAILED : Status.BROKEN
    this.endTest(status, {
      message: error.message,
      trace: error.stack
    })
  }

  item(err, args) {
    if (this.currentTest === null)
      throw new Error('specDone while no test is running')

    this.attachConsoleLogs()

    const requestDataURL =
      this.requestData.method + ' - ' + this.requestData.url

    const responseCodeStatus =
      this.responseData.code + ' - ' + this.responseData.status

    var testDescription
    if (args.item.request.description !== undefined) {
      testDescription = args.item.request.description.content
      testDescription = testDescription.replace(/[*]/g, '')
      testDescription = testDescription.replace(/\n/g, '<br>')
    } else {
      testDescription = ''
    }

    // Set severity label if description contains it
    // if(testDescription.includes('severity=')){

    // }

    this.setDescriptionHtml(
      `<h4 style="color:#2196f3;"><b><i>Request:</i></b></h4><p style="color:#ff9800;"><b> ${requestDataURL}</b></p></p><h4 style="color:#2196f3;"><b><i>Response:</i></b></h4><p style="color:#ff9800;"><b> ${responseCodeStatus}</b></p>`
    )

    if (this.pre_req_script !== '') {
      this.attachPrerequest(this.pre_req_script)
    }

    if (this.test_script !== '') {
      this.attachTestScript(this.test_script)
    }

    if (this.requestData.body !== '' && this.requestData.body !== undefined) {
      let requestBodyData = this.requestData.body
      const mode = this.requestData.body.mode
      if (mode !== undefined) {
        requestBodyData = this.requestData.body[mode]
      }
      requestBodyData = requestBodyData

      this.attachRequest(requestBodyData, this.requestData.contentType)
    }

    if (this.responseData.body.toString() !== '') {
      this.attachResponse(this.responseData.body, this.responseData.contentType)
    }

    if (this.currItem.failedAssertions.length > 0) {
      const msg = this.escape(this.currItem.failedAssertions.join(', '))
      const details = this.escape(
        `Response code: ${this.responseData.code}, status: ${this.responseData.status}`
      )

      this.failTestCase(this.currentTest, {
        name: 'AssertionError',
        message: msg || details,
        trace: this.responseData.body
      })
    } else {
      this.passTestCase()
    }

    this.runningTest = null
  }

  pushStep(step) {
    this.steps.push(step)
  }

  popStep() {
    this.steps.pop()
  }

  endTest(status, details) {
    if (this.currentTest === null) {
      throw new Error('endTest while no test is running')
    }
    if (details) {
      this.currentTest.statusDetails = details
    }
    this.currentTest.status = status
    this.currentTest.stage = Stage.FINISHED
    this.currentTest.endTest()
  }

  itemName(item, cursor) {
    const parentName =
      item.parent && item.parent() && item.parent().name
        ? item.parent().name
        : ''
    const folderOrEmpty =
      !parentName || parentName === this.options.collection.name
        ? ''
        : parentName + '/'
    const iteration = cursor && cursor.cycles > 1 ? '/' + cursor.iteration : ''
    return this.escape(folderOrEmpty + item.name + iteration)
  }

  escape(string) {
    return string
      .replace('\n', '')
      .replace('\r', '')
      .replace('"', '"')
      .replace(
        /[\u0100-\uffff]/g,
        c =>
          `|0x${c
            .charCodeAt(0)
            .toString(16)
            .padStart(4, '0')}`
      )
  }
}

module.exports = AllureReporter
