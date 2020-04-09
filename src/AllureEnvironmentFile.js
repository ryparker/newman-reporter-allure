const fs = require('fs')

function create(resultsDir, newmanEnvironment) {
  console.log('Running AllureEnvironmentFile.create()')

  if (typeof newmanEnvironment === 'object') {
    console.log('Writing file in AllureEnvironmentFile.create().')
    fs.writeFileSync(
      `${resultsDir}/environment.properties`,
      newmanEnvironment.values.reduce((accumulator, envVariableKeyPair) => {
        return accumulator + `${envVariableKeyPair['key']}=${envVariableKeyPair['value']}\n`
      }, '')
    )
    console.log('Finished writing file in AllureEnvironmentFile.create().')
  }
}

module.exports = { create }
