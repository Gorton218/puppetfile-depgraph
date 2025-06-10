# Example Puppetfile for testing the extension
forge 'https://forgeapi.puppet.com'

# Forge modules with versions
mod 'puppetlabs-stdlib', '9.4.1'
mod 'puppetlabs-apache', '5.7.0'
mod 'puppetlabs-mysql', '16.2.0'
mod 'puppetlabs-mongodb', '0.17.0' # Example of commit

mod 'theforeman/puppet'
    :git => 'https://github.com/theforeman/puppet-foreman.git',
    :ref => '24.2-stable'

# Forge module without version
mod 'puppetlabs-nginx'

# Git modules
# mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'
# mod 'internal-module', :git => 'git@github.com:company/internal-module.git', :ref => 'main'
# mod 'custom-module', :git => 'https://gitlab.com/custom/module.git'
