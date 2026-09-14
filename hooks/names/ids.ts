/** The one pane the plugin opens; its `requestId` at `ui.render`. */
export const PANE_ID = 'agent-flow'
/** The pane's tab title while another pane is open too. */
export const PANE_TITLE = 'Agent flow'
/** The slash command, without the slash. */
export const COMMAND_NAME = 'flow'
/** The command's line in /help. */
export const COMMAND_DESCRIPTION = 'Toggle the agent flow pane; /flow text prints the tree'
/** The store key remembering whether the person keeps the pane open. */
export const STORE_OPEN_KEY = 'agent-flow.open'
/** The root node: the main conversation loop. */
export const ROOT_ID = 'main'
/** The expanded-set key of the "unlisted loops" group. */
export const UNLISTED_KEY = 'unlisted'
/** The group's label. */
export const UNLISTED_GROUP_LABEL = 'unlisted loops'
