import { createInterface } from 'readline'
import Task from './task'
import Module from './module'
import Template from './template'
import options from './options'
import copy from './helpers/copy'
import { getOptions, defaultOptions } from './helpers/options'
import { version } from '../package.json'
import {
  cwd, dir, join, exist, existSync, readDir,
  log, merge, read, write, install, copyFile,
  isTaskName, isTaskFile, basename
} from './helpers/utils'

let helps =
  `
    Usage:

      fbi [command]           run command
      fbi [task]              run a local preference task
      fbi [task] -g           run a global task
      fbi [task] -t           run a template task

    Commands:

      new [template]          init a new template
      rm [task][template]     remove tasks or templates
      cat [task][-t, -g]      cat task content
      ls, list                list all tasks & templates
      i, install              install dependencies
      i -f, install -f        install dependencies force
      add-task                add task files in current folder
      add-tmpl [name]         add current folder as a template named [name]
      -h, --help              output usage information
      -v, --version           output the version number
`

const task = new Task()
const template = new Template(options)

export default class Cli {

  constructor(argvs) {
    this.argvs = argvs
    this.next = true
    this.log = log
    this.options = {}
    this._ = {
      cwd, dir, join, exist, existSync, readDir,
      log, merge, read, write, install, copyFile,
      isTaskName, isTaskFile
    }

      ; (async () => {
        try {
          this.version()
          await this.config()
          await this.help()
          await this.create()
          await this.install()
          await this.remove()
          await this.cat()
          await this.list()
          await this.add()
          await this.run()
        } catch (e) {
          log(e, 0)
        }
      })()
  }

  version() {
    if (!this.next) return

    if (this.argvs[0] === '-v'
      || this.argvs[0] === '--verison') {
      this.next = false
      console.log(version)
    }
  }

  async help() {
    if (!this.next) return

    if (!this.argvs.length
      || this.argvs[0] === '-h'
      || this.argvs[0] === '--help') {
      this.next = false

      const all = await task.all(this.options, true, true)
      helps += `
    Tasks:
    `
      if (all.globals.length) {
        all.globals.map(item => {
          helps += `
      ${item.name} ${item.alias} <global>`
        })
      }

      if (all.template.length) {
        all.template.map(item => {
          helps += `
      ${item.name} ${item.alias} <template>`
        })
      }

      if (all.locals.length) {
        all.locals.map(item => {
          helps += `
      ${item.name} ${item.alias} <local>`
        })
      }

      const tmpls = await template.all()
      if (tmpls.length) {
        helps += `

    Templates:
      `
        tmpls.map(item => {
          helps += `
      ${item}`
        })
      }
      helps += `
      `

      console.log(helps)
    }
  }

  async config() {
    if (!this.next) return

    // user options > tempalte options > default options

    try {
      // default options
      this.options = defaultOptions

      // user options
      const userOptionsPath = cwd(this.options.paths.options)
      this.isfbi = await exist(userOptionsPath)
      const userOptions = this.isfbi ? require(userOptionsPath) : null

      // template options
      if (userOptions && userOptions.template) {
        this.options['node_modules_path'] = dir(
          options.data_templates,
          userOptions.template,
          'node_modules'
        )

        const templateOptionsPath = dir(
          options.data_templates,
          userOptions.template,
          this.options.paths.options
        )

        if (existSync(templateOptionsPath)) {
          const templateOptions = require(templateOptionsPath)
          // merge template options
          this.options = getOptions(templateOptions)
        }
      }

      // merge user options
      this.options = getOptions(userOptions)

    } catch (e) {
      log(e)
    }
  }

  async install() {
    if (!this.next) return

    if (this.argvs[0] === 'i' || this.argvs[0] === 'install') {
      this.next = false

      let force = this.argvs[1] === '-f' || this.argvs[1] === '-force'

      let localdeps = {}
      let tmplDeps = {}
      let taskDeps = {}
      const opts = this.options

      // local package.json => devDependencies
      if (await exist(cwd('package.json'))) {
        localdeps = require(cwd('package.json')).devDependencies
      }

      // template package.json => devDependencies
      if (opts.template) {
        const tmplPkg = dir(options.data_templates, opts.template, 'package.json')
        const tmplPkg_exist = await exist(tmplPkg)
        if (tmplPkg_exist) {
          const tmplPkg_dev = require(tmplPkg)['devDependencies']
          tmplDeps = merge(tmplPkg_dev, localdeps)
        }
        if (Object.keys(tmplDeps).length) {
          let tmplPkgCnt = require(tmplPkg)
          tmplPkgCnt['devDependencies'] = tmplDeps
          await write(tmplPkg, JSON.stringify(tmplPkgCnt, null, 2))
        }
      }

      // task package.json => devDependencies
      else {
        const taskPkg = dir(options.data_tasks, 'package.json')
        const taskPkg_exist = await exist(taskPkg)
        if (taskPkg_exist) {
          const taskPkg_dev = require(taskPkg).devDependencies
          taskDeps = merge(taskPkg_dev, localdeps)
        }
        if (Object.keys(taskDeps).length) {
          let taskPkgCnt = require(taskPkg)
          taskPkgCnt['devDependencies'] = taskDeps
          await write(taskPkg, JSON.stringify(taskPkgCnt, null, 2))
        }
      }

      const npms = opts.npm

      const installTmplDeps = Object.keys(tmplDeps).length
        ? await install(tmplDeps, dir(options.data_templates, opts.template), npms.alias, npms.options)
        : Promise.resolve()

      const installTaskDeps = Object.keys(taskDeps).length
        ? await install(taskDeps, dir(options.data_tasks), npms.alias, npms.options)
        : Promise.resolve()

      // install
      Promise.all([installTmplDeps, installTaskDeps]).then(ret => {
        log('All Dependencies Installed', 1)
      }).catch(err => {
        log(err, 0)
      })

    }
  }

  async create() {
    if (!this.next) return

    if (this.argvs[0] === 'new') {
      this.next = false

      if (!this.argvs[1]) {
        return log(`Usage: fbi new [template name]`, 0)
      }
      // log(this.argvs[1].match(/^[^\\/:*""<>|,]+$/i))
      try {
        const name = this.argvs[1]
        let succ = await template.copy(name, cwd())
        if (succ) {
          log(`Template '${name}' copied to current folder`, 1)
        } else {
          log(`Template '${name}' not found`, 0)
        }
      } catch (e) {
        log(e)
      }
    }
  }

  async remove() {
    if (!this.next) return

    if (this.argvs[0] === 'rm' || this.argvs[0] === 'remove') {
      this.next = false

      const mods = this.argvs.slice(1)
      if (!mods.length) {
        log(`Usage: fbi rm [task] or [template]`)
        process.exit(1)
      } else {
        // for (const mod of mods) {
        //   if (this.tasks[mod]) {
        //     if (this.tasks[mod].module.indexOf('.js') > 0) { // fn task
        //       // del task
        //       const _path = this._.dir(this.tasks[mod].module.replace('../', ''))
        //       const exist = this._.existSync(_path)
        //       if (exist) {
        //         fs.unlinkSync(_path)
        //         dbTasks.del(mod)
        //         log(`Task module '${mod}' removed`, 1)
        //       } else {
        //         log(`Task module '${mod}' not found`, 0)
        //       }
        //     } else {
        //       dbTasks.del(mod)
        //       // TODO: uninstall?
        //       log(`Task module '${mod}' removed`, 1)
        //     }
        //   } else if (this.templates[mod]) {
        //     // del template
        //     dbTemplates.del(mod)
        //     log(`Template '${mod}' removed`, 1)
        //   } else {
        //     log(`Module '${mod}' not found`, 0)
        //   }
        // }
      }
    }
  }

  async cat() {
    if (!this.next) return

    if (this.argvs[0] === 'cat') {
      this.next = false

      if (!this.argvs[1]) {
        return log(`Usage: fbi cat [task] [-t, -g]`, 0)
      }

      const name = this.argvs[1]
      let type = 'local'
      if (this.argvs[2] === '-g') {
        type = 'global'
      } else if (this.argvs[2] === '-t') {
        type = 'template'
      }

      const taskObj = await task.get(name, type, this.options)
      log(`${taskObj.type} task ${name}'s content:

${taskObj.cnt}
        `)
    }
  }

  async list() {
    if (!this.next) return

    if (this.argvs[0] === 'ls'
      || this.argvs[0] === 'list') {
      this.next = false

      let helps = ''
      const all = await task.all(this.options, true, false)
      helps += `
    Tasks:
    `
      if (all.globals.length) {
        all.globals.map(item => {
          helps += `
      ${item.name} ${item.alias} <global>`
        })
      }

      if (all.template.length) {
        all.template.map(item => {
          helps += `
      ${item.name} ${item.alias} <template>`
        })
      }

      if (all.locals.length) {
        all.locals.map(item => {
          helps += `
      ${item.name} ${item.alias} <local>`
        })
      }

      const tmpls = await template.all()
      if (tmpls.length) {
        helps += `

    Templates:
      `
        tmpls.map(item => {
          helps += `
      ${item}`
        })
      }
      helps += `
      `

      console.log(helps)
    }
  }

  async add() {
    if (!this.next) return

    if (this.argvs[0] === 'add-tmpl') {
      this.next = false

      // add template
      const name = this.argvs[1] || basename(cwd(), '')
      const isExist = await exist(dir(options.data_templates, name))

      if (isExist) {
        log(`tempalte '${name}' already exist, type 'y' to replace, type a name to create a new one`, 0)

        let
          rl = createInterface(process.stdin, process.stdout),
          prompts = ['name'],
          p = 0,
          data = {}

        let get = function () {
          rl.setPrompt(prompts[p] + '> ')
          rl.prompt()

          p++
        }

        get()

        rl.on('line', (line) => {
          data[prompts[p - 1]] = line

          if (p === prompts.length) {
            return rl.close()
          }

          get()
        }).on('close', async () => {
          if (data.name === 'y') {
            copy(cwd(), dir(options.data_templates, name), ['dst', 'dist'])
          } else if (data.name === '') {
            log('name can\'t be empty')
          } else {
            const isExist2 = await exist(dir(options.data_templates, data.name))
            if (isExist2) {
              log(`${data.name} already exist too`, 0)
              process.exit(0)
            } else {
              copy(cwd(), dir(options.data_templates, data.name), ['dst', 'dist'])
            }
          }

          // process.exit(0) // can't do it right away
        })
      } else {
        copy(cwd(), dir(options.data_templates, name))
      }

    } else if (this.argvs[0] === 'add-task') {
      this.next = false

      log(this.argvs)

      if (!this.argvs[1]) {
        log(`Usage: fbi add-task [*] or [name.js]`)
      } else {
        log('y')
        let ts = this.argvs.slice(1)
        ts = ts.filter(isTaskFile)
        if (!ts.length) {
          log(`no task found.`, 0)
        } else {
          ts.map(async (item) => {
            // TODO: mkdirp
            await copyFile(cwd(item), dir(options.data_tasks, basename(item, '.js'), 'index.js'))
            log(`task '${item}' added successfully`, 1)
          })
        }
      }
    }
  }

  async run() {
    if (!this.next) return

    let cmds = this.argvs
    if (this.argvs.length > 0) {
      let type = 'local'
      if (this.argvs[1] === '-g') {
        type = 'global'
      } else if (this.argvs[1] === '-t') {
        type = 'template'
      }
      try {
        cmds = cmds.filter(isTaskName)
        cmds.map(async (cmd) => {
          const taskObj = await task.get(cmd, type, this.options)
          if (taskObj.cnt) {
            log(`Running ${taskObj.type} task '${taskObj.name}'...`, 1)
            task.run(cmd, this, taskObj)
          } else {
            log(`Task not found: '${cmd}`, 0)
          }
        })
      } catch (e) {
        log(`Task function error`, 0)
        log(e)
      }
    }
  }

}