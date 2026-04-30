const BASH_COMPLETIONS = `\
_work_kit_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="init next complete status context validate loopback workflow doctor setup upgrade completions"

  if [ $COMP_CWORD -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return
  fi

  local cmd="\${COMP_WORDS[1]}"
  case "$cmd" in
    complete|context|validate)
      local phases="triage/classify plan/understand plan/design plan/audit build/setup build/implement build/commit test/exercise test/validate review/scope review/review review/resolve deploy/ship"
      COMPREPLY=($(compgen -W "$phases" -- "$cur"))
      ;;
    init)
      COMPREPLY=($(compgen -W "--mode --description --classification --worktree-root" -- "$cur"))
      ;;
    completions)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))
      ;;
  esac
}
complete -F _work_kit_completions work-kit`;

const ZSH_COMPLETIONS = `\
#compdef work-kit

_work_kit() {
  local -a commands phases init_opts shells

  commands=(
    'init:Create worktree and initialize state'
    'next:Get the next action to perform'
    'complete:Mark a phase/step as complete'
    'status:Show current state summary'
    'context:Extract Final sections needed for a phase agent'
    'validate:Check prerequisites for a phase'
    'loopback:Register a loop-back transition'
    'workflow:Manage auto-kit dynamic workflow'
    'doctor:Check CLI installation and environment health'
    'setup:Install work-kit skills into a project'
    'upgrade:Upgrade work-kit'
    'completions:Output shell completions'
  )

  phases=(
    'triage/classify'
    'plan/understand' 'plan/design' 'plan/audit'
    'build/setup' 'build/implement' 'build/commit'
    'test/exercise' 'test/validate'
    'review/scope' 'review/review' 'review/resolve'
    'deploy/ship'
  )

  init_opts=(
    '--mode[Workflow mode]:mode:(full auto)'
    '--description[Description of the work]:text:'
    '--classification[Work classification]:type:(bug-fix small-change refactor feature large-feature)'
    '--worktree-root[Override worktree root directory]:path:_files -/'
  )

  shells=(bash zsh fish)

  if (( CURRENT == 2 )); then
    _describe -t commands 'work-kit command' commands
    return
  fi

  case $words[2] in
    complete|context|validate)
      _describe -t phases 'phase' phases
      ;;
    init)
      _arguments $init_opts
      ;;
    completions)
      _describe -t shells 'shell' shells
      ;;
  esac
}

compdef _work_kit work-kit`;

const FISH_COMPLETIONS = `\
# Disable file completions by default
complete -c work-kit -f

# Top-level commands
complete -c work-kit -n '__fish_use_subcommand' -a 'init' -d 'Create worktree and initialize state'
complete -c work-kit -n '__fish_use_subcommand' -a 'next' -d 'Get the next action to perform'
complete -c work-kit -n '__fish_use_subcommand' -a 'complete' -d 'Mark a phase/step as complete'
complete -c work-kit -n '__fish_use_subcommand' -a 'status' -d 'Show current state summary'
complete -c work-kit -n '__fish_use_subcommand' -a 'context' -d 'Extract Final sections needed for a phase agent'
complete -c work-kit -n '__fish_use_subcommand' -a 'validate' -d 'Check prerequisites for a phase'
complete -c work-kit -n '__fish_use_subcommand' -a 'loopback' -d 'Register a loop-back transition'
complete -c work-kit -n '__fish_use_subcommand' -a 'workflow' -d 'Manage auto-kit dynamic workflow'
complete -c work-kit -n '__fish_use_subcommand' -a 'doctor' -d 'Check CLI installation and environment health'
complete -c work-kit -n '__fish_use_subcommand' -a 'setup' -d 'Install work-kit skills into a project'
complete -c work-kit -n '__fish_use_subcommand' -a 'upgrade' -d 'Upgrade work-kit'
complete -c work-kit -n '__fish_use_subcommand' -a 'completions' -d 'Output shell completions'

# Phase completions for complete, context, validate
set -l phase_cmds 'complete context validate'
set -l phases 'triage/classify' 'plan/understand' 'plan/design' 'plan/audit' 'build/setup' 'build/implement' 'build/commit' 'test/exercise' 'test/validate' 'review/scope' 'review/review' 'review/resolve' 'deploy/ship'
for phase in $phases
  complete -c work-kit -n "__fish_seen_subcommand_from $phase_cmds" -a "$phase"
end

# init options
complete -c work-kit -n '__fish_seen_subcommand_from init' -l mode -d 'Workflow mode' -ra 'full auto'
complete -c work-kit -n '__fish_seen_subcommand_from init' -l description -d 'Description of the work'
complete -c work-kit -n '__fish_seen_subcommand_from init' -l classification -d 'Work classification' -ra 'bug-fix small-change refactor feature large-feature'
complete -c work-kit -n '__fish_seen_subcommand_from init' -l worktree-root -d 'Override worktree root directory'

# completions subcommand
complete -c work-kit -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish'`;

export function completionsCommand(shell: string): void {
  switch (shell) {
    case "bash":
      console.log(BASH_COMPLETIONS);
      break;
    case "zsh":
      console.log(ZSH_COMPLETIONS);
      break;
    case "fish":
      console.log(FISH_COMPLETIONS);
      break;
    default:
      console.error(`Unknown shell: ${shell}. Supported: bash, zsh, fish`);
      process.exit(1);
  }
}
