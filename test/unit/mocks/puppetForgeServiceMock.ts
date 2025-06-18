import { ForgeModule, ForgeVersion, PuppetForgeService } from '../../src/../services/puppetForgeService';

/**
 * Mock data for Puppet Forge modules
 */
export const mockModuleData: Map<string, {
    releases: ForgeVersion[],
    latestVersion: string,
    latestSafeVersion: string
}> = new Map([
    ['puppetlabs/stdlib', {
        latestVersion: '9.0.0',
        latestSafeVersion: '8.6.0',
        releases: [
            {
                version: '9.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 1000000,
                file_size: 100000,
                file_md5: 'abc123',
                file_uri: '/v3/files/puppetlabs-stdlib-9.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '8.6.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 900000,
                file_size: 95000,
                file_md5: 'def456',
                file_uri: '/v3/files/puppetlabs-stdlib-8.6.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '8.5.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 800000,
                file_size: 94000,
                file_md5: 'ghi789',
                file_uri: '/v3/files/puppetlabs-stdlib-8.5.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '8.5.0-rc1',
                created_at: '2023-02-15T00:00:00Z',
                updated_at: '2023-02-15T00:00:00Z',
                downloads: 1000,
                file_size: 93000,
                file_md5: 'jkl012',
                file_uri: '/v3/files/puppetlabs-stdlib-8.5.0-rc1.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '8.4.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 700000,
                file_size: 92000,
                file_md5: 'mno345',
                file_uri: '/v3/files/puppetlabs-stdlib-8.4.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '7.0.0',
                created_at: '2022-01-01T00:00:00Z',
                updated_at: '2022-01-01T00:00:00Z',
                downloads: 500000,
                file_size: 80000,
                file_md5: 'pqr678',
                file_uri: '/v3/files/puppetlabs-stdlib-7.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '6.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 400000,
                file_size: 70000,
                file_md5: 'stu901',
                file_uri: '/v3/files/puppetlabs-stdlib-6.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '5.0.0',
                created_at: '2020-01-01T00:00:00Z',
                updated_at: '2020-01-01T00:00:00Z',
                downloads: 300000,
                file_size: 60000,
                file_md5: 'vwx234',
                file_uri: '/v3/files/puppetlabs-stdlib-5.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '4.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 200000,
                file_size: 50000,
                file_md5: 'yz567',
                file_uri: '/v3/files/puppetlabs-stdlib-4.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '3.0.0',
                created_at: '2018-01-01T00:00:00Z',
                updated_at: '2018-01-01T00:00:00Z',
                downloads: 100000,
                file_size: 40000,
                file_md5: 'abc890',
                file_uri: '/v3/files/puppetlabs-stdlib-3.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '2.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 50000,
                file_size: 30000,
                file_md5: 'def123',
                file_uri: '/v3/files/puppetlabs-stdlib-2.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '1.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 20000,
                file_md5: 'ghi456',
                file_uri: '/v3/files/puppetlabs-stdlib-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppetlabs/concat', {
        latestVersion: '8.0.0-rc1',
        latestSafeVersion: '7.4.0',
        releases: [
            {
                version: '8.0.0-rc1',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 500,
                file_size: 80000,
                file_md5: 'concat800rc1',
                file_uri: '/v3/files/puppetlabs-concat-8.0.0-rc1.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '7.4.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 500000,
                file_size: 75000,
                file_md5: 'concat740',
                file_uri: '/v3/files/puppetlabs-concat-7.4.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '7.3.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 400000,
                file_size: 74000,
                file_md5: 'concat730',
                file_uri: '/v3/files/puppetlabs-concat-7.3.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '7.2.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 300000,
                file_size: 73000,
                file_md5: 'concat720',
                file_uri: '/v3/files/puppetlabs-concat-7.2.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '7.0.0',
                created_at: '2022-01-01T00:00:00Z',
                updated_at: '2022-01-01T00:00:00Z',
                downloads: 200000,
                file_size: 70000,
                file_md5: 'concat700',
                file_uri: '/v3/files/puppetlabs-concat-7.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '6.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 100000,
                file_size: 60000,
                file_md5: 'concat600',
                file_uri: '/v3/files/puppetlabs-concat-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2020-01-01T00:00:00Z',
                updated_at: '2020-01-01T00:00:00Z',
                downloads: 50000,
                file_size: 50000,
                file_md5: 'concat500',
                file_uri: '/v3/files/puppetlabs-concat-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 25000,
                file_size: 40000,
                file_md5: 'concat400',
                file_uri: '/v3/files/puppetlabs-concat-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2018-01-01T00:00:00Z',
                updated_at: '2018-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 30000,
                file_md5: 'concat300',
                file_uri: '/v3/files/puppetlabs-concat-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 20000,
                file_md5: 'concat200',
                file_uri: '/v3/files/puppetlabs-concat-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 10000,
                file_md5: 'concat100',
                file_uri: '/v3/files/puppetlabs-concat-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppetlabs/apache', {
        latestVersion: '11.0.0',
        latestSafeVersion: '10.1.1',
        releases: [
            {
                version: '11.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 50000,
                file_size: 150000,
                file_md5: 'apache1100',
                file_uri: '/v3/files/puppetlabs-apache-11.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '10.1.1',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 100000,
                file_size: 145000,
                file_md5: 'apache1011',
                file_uri: '/v3/files/puppetlabs-apache-10.1.1.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '10.1.0',
                created_at: '2023-05-15T00:00:00Z',
                updated_at: '2023-05-15T00:00:00Z',
                downloads: 90000,
                file_size: 144000,
                file_md5: 'apache1010',
                file_uri: '/v3/files/puppetlabs-apache-10.1.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '10.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 80000,
                file_size: 142000,
                file_md5: 'apache1000',
                file_uri: '/v3/files/puppetlabs-apache-10.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '9.0.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 70000,
                file_size: 140000,
                file_md5: 'apache900',
                file_uri: '/v3/files/puppetlabs-apache-9.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '8.0.0',
                created_at: '2022-01-01T00:00:00Z',
                updated_at: '2022-01-01T00:00:00Z',
                downloads: 60000,
                file_size: 130000,
                file_md5: 'apache800',
                file_uri: '/v3/files/puppetlabs-apache-8.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 8.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2020-01-01T00:00:00Z',
                updated_at: '2020-01-01T00:00:00Z',
                downloads: 30000,
                file_size: 100000,
                file_md5: 'apache500',
                file_uri: '/v3/files/puppetlabs-apache-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2018-01-01T00:00:00Z',
                updated_at: '2018-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 80000,
                file_md5: 'apache300',
                file_uri: '/v3/files/puppetlabs-apache-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.2.0 < 5.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.2.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 70000,
                file_md5: 'apache200',
                file_uri: '/v3/files/puppetlabs-apache-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 1.0.0 < 3.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 60000,
                file_md5: 'apache100',
                file_uri: '/v3/files/puppetlabs-apache-1.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            }
        ]
    }],
    ['puppetlabs/mysql', {
        latestVersion: '14.0.0',
        latestSafeVersion: '13.3.0',
        releases: [
            {
                version: '14.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 30000,
                file_size: 120000,
                file_md5: 'mysql1400',
                file_uri: '/v3/files/puppetlabs-mysql-14.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '13.3.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 60000,
                file_size: 115000,
                file_md5: 'mysql1330',
                file_uri: '/v3/files/puppetlabs-mysql-13.3.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '13.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 50000,
                file_size: 110000,
                file_md5: 'mysql1300',
                file_uri: '/v3/files/puppetlabs-mysql-13.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '12.0.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 40000,
                file_size: 105000,
                file_md5: 'mysql1200',
                file_uri: '/v3/files/puppetlabs-mysql-12.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '10.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 20000,
                file_size: 90000,
                file_md5: 'mysql1000',
                file_uri: '/v3/files/puppetlabs-mysql-10.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 60000,
                file_md5: 'mysql500',
                file_uri: '/v3/files/puppetlabs-mysql-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 40000,
                file_md5: 'mysql300',
                file_uri: '/v3/files/puppetlabs-mysql-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2016-06-01T00:00:00Z',
                updated_at: '2016-06-01T00:00:00Z',
                downloads: 500,
                file_size: 30000,
                file_md5: 'mysql200',
                file_uri: '/v3/files/puppetlabs-mysql-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 3.2.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 100,
                file_size: 20000,
                file_md5: 'mysql100',
                file_uri: '/v3/files/puppetlabs-mysql-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppetlabs/postgresql', {
        latestVersion: '9.0.0',
        latestSafeVersion: '8.3.0',
        releases: [
            {
                version: '9.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 20000,
                file_size: 130000,
                file_md5: 'postgresql900',
                file_uri: '/v3/files/puppetlabs-postgresql-9.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '8.3.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 40000,
                file_size: 125000,
                file_md5: 'postgresql830',
                file_uri: '/v3/files/puppetlabs-postgresql-8.3.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '8.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 30000,
                file_size: 120000,
                file_md5: 'postgresql800',
                file_uri: '/v3/files/puppetlabs-postgresql-8.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '7.0.0',
                created_at: '2022-01-01T00:00:00Z',
                updated_at: '2022-01-01T00:00:00Z',
                downloads: 20000,
                file_size: 110000,
                file_md5: 'postgresql700',
                file_uri: '/v3/files/puppetlabs-postgresql-7.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 8.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '6.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 100000,
                file_md5: 'postgresql600',
                file_uri: '/v3/files/puppetlabs-postgresql-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.0.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 90000,
                file_md5: 'postgresql500',
                file_uri: '/v3/files/puppetlabs-postgresql-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 6.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.0.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 80000,
                file_md5: 'postgresql400',
                file_uri: '/v3/files/puppetlabs-postgresql-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 1.0.0 < 3.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2016-06-01T00:00:00Z',
                updated_at: '2016-06-01T00:00:00Z',
                downloads: 500,
                file_size: 70000,
                file_md5: 'postgresql300',
                file_uri: '/v3/files/puppetlabs-postgresql-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 3.2.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 100,
                file_size: 60000,
                file_md5: 'postgresql200',
                file_uri: '/v3/files/puppetlabs-postgresql-2.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '1.0.0',
                created_at: '2015-01-01T00:00:00Z',
                updated_at: '2015-01-01T00:00:00Z',
                downloads: 50,
                file_size: 50000,
                file_md5: 'postgresql100',
                file_uri: '/v3/files/puppetlabs-postgresql-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppetlabs/firewall', {
        latestVersion: '6.0.0',
        latestSafeVersion: '5.0.0',
        releases: [
            {
                version: '6.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 15000,
                file_size: 100000,
                file_md5: 'firewall600',
                file_uri: '/v3/files/puppetlabs-firewall-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 30000,
                file_size: 95000,
                file_md5: 'firewall500',
                file_uri: '/v3/files/puppetlabs-firewall-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 20000,
                file_size: 90000,
                file_md5: 'firewall400',
                file_uri: '/v3/files/puppetlabs-firewall-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 80000,
                file_md5: 'firewall300',
                file_uri: '/v3/files/puppetlabs-firewall-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 70000,
                file_md5: 'firewall200',
                file_uri: '/v3/files/puppetlabs-firewall-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 60000,
                file_md5: 'firewall100',
                file_uri: '/v3/files/puppetlabs-firewall-1.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            }
        ]
    }],
    ['puppetlabs/ntp', {
        latestVersion: '10.0.0',
        latestSafeVersion: '9.2.0',
        releases: [
            {
                version: '10.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 10000,
                file_size: 80000,
                file_md5: 'ntp1000',
                file_uri: '/v3/files/puppetlabs-ntp-10.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '9.2.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 20000,
                file_size: 75000,
                file_md5: 'ntp920',
                file_uri: '/v3/files/puppetlabs-ntp-9.2.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '9.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 15000,
                file_size: 73000,
                file_md5: 'ntp900',
                file_uri: '/v3/files/puppetlabs-ntp-9.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '8.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 10000,
                file_size: 70000,
                file_md5: 'ntp800',
                file_uri: '/v3/files/puppetlabs-ntp-8.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '7.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 65000,
                file_md5: 'ntp700',
                file_uri: '/v3/files/puppetlabs-ntp-7.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '6.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 2000,
                file_size: 60000,
                file_md5: 'ntp600',
                file_uri: '/v3/files/puppetlabs-ntp-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.6.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2016-06-01T00:00:00Z',
                updated_at: '2016-06-01T00:00:00Z',
                downloads: 1000,
                file_size: 55000,
                file_md5: 'ntp500',
                file_uri: '/v3/files/puppetlabs-ntp-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.6.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 500,
                file_size: 50000,
                file_md5: 'ntp400',
                file_uri: '/v3/files/puppetlabs-ntp-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2015-01-01T00:00:00Z',
                updated_at: '2015-01-01T00:00:00Z',
                downloads: 100,
                file_size: 40000,
                file_md5: 'ntp300',
                file_uri: '/v3/files/puppetlabs-ntp-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 3.2.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2014-01-01T00:00:00Z',
                updated_at: '2014-01-01T00:00:00Z',
                downloads: 50,
                file_size: 30000,
                file_md5: 'ntp200',
                file_uri: '/v3/files/puppetlabs-ntp-2.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            },
            {
                version: '1.0.0',
                created_at: '2013-01-01T00:00:00Z',
                updated_at: '2013-01-01T00:00:00Z',
                downloads: 10,
                file_size: 20000,
                file_md5: 'ntp100',
                file_uri: '/v3/files/puppetlabs-ntp-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppetlabs/motd', {
        latestVersion: '7.0.0',
        latestSafeVersion: '6.3.0',
        releases: [
            {
                version: '7.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 5000,
                file_size: 50000,
                file_md5: 'motd700',
                file_uri: '/v3/files/puppetlabs-motd-7.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '6.3.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 10000,
                file_size: 48000,
                file_md5: 'motd630',
                file_uri: '/v3/files/puppetlabs-motd-6.3.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '6.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 8000,
                file_size: 46000,
                file_md5: 'motd600',
                file_uri: '/v3/files/puppetlabs-motd-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 40000,
                file_md5: 'motd500',
                file_uri: '/v3/files/puppetlabs-motd-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 2000,
                file_size: 35000,
                file_md5: 'motd400',
                file_uri: '/v3/files/puppetlabs-motd-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 30000,
                file_md5: 'motd300',
                file_uri: '/v3/files/puppetlabs-motd-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 500,
                file_size: 25000,
                file_md5: 'motd200',
                file_uri: '/v3/files/puppetlabs-motd-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 3.2.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2015-01-01T00:00:00Z',
                updated_at: '2015-01-01T00:00:00Z',
                downloads: 100,
                file_size: 20000,
                file_md5: 'motd100',
                file_uri: '/v3/files/puppetlabs-motd-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }],
    ['puppet/nginx', {
        latestVersion: '5.0.0',
        latestSafeVersion: '4.4.0',
        releases: [
            {
                version: '5.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 8000,
                file_size: 110000,
                file_md5: 'nginx500',
                file_uri: '/v3/files/puppet-nginx-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.25.0 < 10.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '4.4.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 15000,
                file_size: 105000,
                file_md5: 'nginx440',
                file_uri: '/v3/files/puppet-nginx-4.4.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.25.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '4.3.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 12000,
                file_size: 103000,
                file_md5: 'nginx430',
                file_uri: '/v3/files/puppet-nginx-4.3.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.25.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2022-12-01T00:00:00Z',
                updated_at: '2022-12-01T00:00:00Z',
                downloads: 10000,
                file_size: 100000,
                file_md5: 'nginx400',
                file_uri: '/v3/files/puppet-nginx-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.25.0 < 9.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 4.1.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 90000,
                file_md5: 'nginx300',
                file_uri: '/v3/files/puppet-nginx-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.25.0 < 8.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 3.0.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 2000,
                file_size: 80000,
                file_md5: 'nginx200',
                file_uri: '/v3/files/puppet-nginx-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.13.0 < 7.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 2.0.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 500,
                file_size: 70000,
                file_md5: 'nginx100',
                file_uri: '/v3/files/puppet-nginx-1.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' },
                        { name: 'puppetlabs/concat', version_requirement: '>= 1.0.0 < 3.0.0' }
                    ]
                }
            }
        ]
    }],
    ['puppetlabs/docker', {
        latestVersion: '8.0.0',
        latestSafeVersion: '7.0.0', 
        releases: [
            {
                version: '8.0.0',
                created_at: '2023-09-01T00:00:00Z',
                updated_at: '2023-09-01T00:00:00Z',
                downloads: 5000,
                file_size: 90000,
                file_md5: 'docker800',
                file_uri: '/v3/files/puppetlabs-docker-8.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 10.0.0' }
                    ]
                }
            },
            {
                version: '7.0.0',
                created_at: '2023-06-01T00:00:00Z',
                updated_at: '2023-06-01T00:00:00Z',
                downloads: 10000,
                file_size: 85000,
                file_md5: 'docker700',
                file_uri: '/v3/files/puppetlabs-docker-7.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '6.0.0',
                created_at: '2023-03-01T00:00:00Z',
                updated_at: '2023-03-01T00:00:00Z',
                downloads: 8000,
                file_size: 82000,
                file_md5: 'docker600',
                file_uri: '/v3/files/puppetlabs-docker-6.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 9.0.0' }
                    ]
                }
            },
            {
                version: '5.0.0',
                created_at: '2022-01-01T00:00:00Z',
                updated_at: '2022-01-01T00:00:00Z',
                downloads: 5000,
                file_size: 80000,
                file_md5: 'docker500',
                file_uri: '/v3/files/puppetlabs-docker-5.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 8.0.0' }
                    ]
                }
            },
            {
                version: '4.0.0',
                created_at: '2021-01-01T00:00:00Z',
                updated_at: '2021-01-01T00:00:00Z',
                downloads: 3000,
                file_size: 75000,
                file_md5: 'docker400',
                file_uri: '/v3/files/puppetlabs-docker-4.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 7.0.0' }
                    ]
                }
            },
            {
                version: '3.0.0',
                created_at: '2019-01-01T00:00:00Z',
                updated_at: '2019-01-01T00:00:00Z',
                downloads: 1000,
                file_size: 70000,
                file_md5: 'docker300',
                file_uri: '/v3/files/puppetlabs-docker-3.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.19.0 < 6.0.0' }
                    ]
                }
            },
            {
                version: '2.0.0',
                created_at: '2017-01-01T00:00:00Z',
                updated_at: '2017-01-01T00:00:00Z',
                downloads: 500,
                file_size: 60000,
                file_md5: 'docker200',
                file_uri: '/v3/files/puppetlabs-docker-2.0.0.tar.gz',
                metadata: {
                    dependencies: [
                        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0 < 5.0.0' }
                    ]
                }
            },
            {
                version: '1.0.0',
                created_at: '2016-01-01T00:00:00Z',
                updated_at: '2016-01-01T00:00:00Z',
                downloads: 100,
                file_size: 50000,
                file_md5: 'docker100',
                file_uri: '/v3/files/puppetlabs-docker-1.0.0.tar.gz',
                metadata: {
                    dependencies: []
                }
            }
        ]
    }]
]);

/**
 * Create a mock PuppetForgeService class
 */
export class MockPuppetForgeService {
    private static moduleVersionCache: Map<string, Map<string, ForgeVersion>> = new Map();

    public static clearCache(): void {
        this.moduleVersionCache.clear();
    }

    public static cleanupAgents(): void {
        // No-op for mock
    }

    public static hasModuleCached(moduleName: string): boolean {
        const moduleCache = this.moduleVersionCache.get(moduleName);
        return moduleCache !== undefined && moduleCache.size > 0;
    }

    public static async getModule(moduleName: string): Promise<ForgeModule | null> {
        const moduleData = mockModuleData.get(moduleName);
        if (!moduleData) {
            return null;
        }

        const releases = moduleData.releases;
        if (releases.length === 0) {
            return null;
        }

        const latestRelease = releases[0];
        const moduleSlug = moduleName.replace('/', '-');
        const owner = moduleName.includes('/') 
            ? moduleName.split('/')[0]
            : moduleName.split('-')[0];

        return {
            name: moduleName,
            slug: moduleSlug,
            owner: {
                username: owner,
                slug: owner
            },
            current_release: {
                version: latestRelease.version,
                created_at: latestRelease.created_at,
                metadata: latestRelease.metadata
            },
            releases: releases,
            downloads: 0,
            feedback_score: 0
        };
    }

    public static async getModuleReleases(moduleName: string): Promise<ForgeVersion[]> {
        const moduleCache = this.moduleVersionCache.get(moduleName);
        if (moduleCache && moduleCache.size > 0) {
            return Array.from(moduleCache.values()).sort((a, b) => 
                PuppetForgeService.compareVersions(b.version, a.version)
            );
        }

        const moduleData = mockModuleData.get(moduleName);
        if (!moduleData) {
            return [];
        }

        const releases = moduleData.releases;
        
        if (releases.length > 0) {
            const versionMap = new Map<string, ForgeVersion>();
            for (const release of releases) {
                versionMap.set(release.version, release);
            }
            this.moduleVersionCache.set(moduleName, versionMap);
        }
        
        return releases;
    }

    public static async getReleaseForVersion(moduleName: string, version: string): Promise<ForgeVersion | null> {
        const moduleCache = this.moduleVersionCache.get(moduleName);
        if (moduleCache) {
            const cachedVersion = moduleCache.get(version);
            if (cachedVersion) {
                return cachedVersion;
            }
        }

        const releases = await this.getModuleReleases(moduleName);
        
        const updatedModuleCache = this.moduleVersionCache.get(moduleName);
        if (updatedModuleCache) {
            return updatedModuleCache.get(version) ?? null;
        }
        
        return releases.find(r => r.version === version) ?? null;
    }

    public static async getLatestVersion(moduleName: string): Promise<string | null> {
        const moduleData = mockModuleData.get(moduleName);
        return moduleData?.latestVersion ?? null;
    }

    public static isSafeVersion(version: string): boolean {
        return PuppetForgeService.isSafeVersion(version);
    }

    public static async getLatestSafeVersion(moduleName: string): Promise<string | null> {
        const moduleData = mockModuleData.get(moduleName);
        return moduleData?.latestSafeVersion ?? null;
    }

    public static compareVersions(version1: string, version2: string): number {
        return PuppetForgeService.compareVersions(version1, version2);
    }

    public static async checkForUpdate(
        moduleName: string, 
        currentVersion?: string, 
        safeOnly: boolean = false
    ): Promise<{ hasUpdate: boolean; latestVersion: string | null; currentVersion?: string }> {
        const latestVersion = safeOnly 
            ? await this.getLatestSafeVersion(moduleName)
            : await this.getLatestVersion(moduleName);

        if (!latestVersion) {
            return { hasUpdate: false, latestVersion: null, currentVersion };
        }

        if (!currentVersion) {
            return { hasUpdate: true, latestVersion, currentVersion };
        }

        const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;
        return { hasUpdate, latestVersion, currentVersion };
    }
}

/**
 * Helper function to replace PuppetForgeService with MockPuppetForgeService in tests
 */
export function setupPuppetForgeMock(): void {
    // This would be used with Jest mocks or other mocking frameworks
    // Example: jest.mock('../../services/puppetForgeService', () => ({ PuppetForgeService: MockPuppetForgeService }));
}