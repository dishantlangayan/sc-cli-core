import {Command, Flags, Interfaces} from '@oclif/core'

import {BrokerAuthManager} from './auth/auth-manager.js'
import {OrgManager} from './auth/org-manager.js'

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<(typeof ScCommand)['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

/**
 * A base command that provided common functionality for all sc commands.
 *
 * All implementations of this class need to implement the run() method.
 *
 */
export abstract class ScCommand<T extends typeof Command> extends Command {
  // define flags that can be inherited by any command that extends BaseCommand
  static baseFlags = {
    'log-level': Flags.option({
      default: 'info',
      helpGroup: 'GLOBAL',
      options: ['debug', 'warn', 'error', 'info', 'trace'] as const,
      summary: 'Specify level for logging.',
    })(),
  }
  // add the --json flag
  static enableJsonFlag = true
  protected args!: Args<T>
  protected flags!: Flags<T>
  private _brokerAuthManager?: BrokerAuthManager
  private _orgManager?: OrgManager

  protected async catch(err: Error & {exitCode?: number}): Promise<unknown> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<unknown> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }

  /**
   * Get BrokerAuthManager instance with lazy initialization
   * @returns Initialized BrokerAuthManager instance
   */
  protected async getBrokerAuthManager(): Promise<BrokerAuthManager> {
    if (!this._brokerAuthManager) {
      this._brokerAuthManager = BrokerAuthManager.getInstance()
      await this._brokerAuthManager.initialize()
    }

    return this._brokerAuthManager
  }

  /**
   * Get OrgManager instance with lazy initialization
   * @returns Initialized OrgManager instance
   */
  protected async getOrgManager(): Promise<OrgManager> {
    if (!this._orgManager) {
      this._orgManager = OrgManager.getInstance()
      await this._orgManager.initialize()
    }

    return this._orgManager
  }

  public async init(): Promise<void> {
    await super.init()
    const {args, flags} = await this.parse({
      args: this.ctor.args,
      baseFlags: (super.ctor as typeof ScCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      flags: this.ctor.flags,
      strict: this.ctor.strict,
    })
    this.flags = flags as Flags<T>
    this.args = args as Args<T>
  }
}
