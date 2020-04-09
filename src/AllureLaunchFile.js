const fs = require('fs')
function create(resultsDir, name) {
  console.log('Writing file in AllureLaunchFile.create().')

  fs.writeFileSync(
    `${resultsDir}/launch.json`,
    JSON.stringify({
      name,
    })
  )
  console.log('Finished writing file in AllureLaunchFile.create().')
}

module.exports = { create }
