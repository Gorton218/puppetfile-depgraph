# Example Puppetfile for testing the extension
forge 'https://forgeapi.puppet.com'

# Forge modules with versions
mod 'puppetlabs-stdlib', '9.4.1'
mod 'puppetlabs-apache', '5.7.0'
mod 'puppetlabs-mysql', '16.2.0'
mod 'puppetlabs-mongodb', '0.17.0' # Example of comment
mod 'puppetlabs-postgresql', '6.4.0'
mod 'theforeman-foreman', '22.1.1'
mod 'theforeman-foreman_proxy', '25.1.0'

# Example of a git-based module with a specific tag but without coma
mod 'theforeman-puppet'
    :git => 'https://github.com/theforeman/puppet-foreman.git',
    :ref => '24.2-stable'

# Example of a module with the name different from the one in the `metadata.json`
# This is a module that is not on the Forge, but is available on GitHub
mod 'echocat/graphite',
    :git => 'https://github.com/echocat/puppet-graphite.git',
    :ref => 'master'

mod 'puppet/collectd', # Example of a git-based module with comment
    :git => 'https://github.com/voxpupuli/puppet-collectd.git',
    :ref => 'v14.0.0'

# Forge module without version
mod 'puppetlabs-nginx'

# Git modules
# mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'
# mod 'internal-module', :git => 'git@github.com:company/internal-module.git', :ref => 'main'
# mod 'custom-module', :git => 'https://gitlab.com/custom/module.git'
