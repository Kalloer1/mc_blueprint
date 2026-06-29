import os

import requests

host = "redenmc.com"
key = "cae43db142664664989d50b7c690d397"

json = {
    "host": host,
    "key": key,
    "keyLocation": f"https://redenmc.com/{key}.txt",
    "urlList": []
}

os.path.exists('.output/public/__sitemap__/index.xml')
# list files
for file in os.listdir('.output/public/__sitemap__/'):
    if file.endswith('.xml'):
        with open(f'.output/public/__sitemap__/{file}', 'r') as f:
            content = f.read()
            # find <loc> tags
            urls = content.split('<loc>')
            urls.pop(0)
            for url in urls:
                url = url.split('</loc>')[0]
                json['urlList'].append(url)

print(json)
print('Found', len(json['urlList']), 'urls')
input('Press enter to continue')

requests.post('https://api.indexnow.org/IndexNow', json=json)
