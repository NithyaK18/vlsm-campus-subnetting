# Zero-Waste Campus Subnetting

A VLSM (Variable Length Subnet Masking) planner that splits one IPv4 block across facilities with exactly the space each needs.

**Live demo:** _add your GitHub Pages link here_

## The problem
One block, 192.168.50.0/24, must serve four facilities: AI Research Lab (100 hosts), IoT Prototyping Lab (50), Staff Administration Room (20) and Core Server Room (5). Fixed-size subnets either run out of room or waste addresses.

## The method
1. Add 2 to the host count (network and broadcast addresses).
2. Round up to the next power of two; that is the block size.
3. Prefix length = 32 minus the number of host bits.
4. Allocate the largest block first so every block stays aligned on its own boundary.
5. List whatever space is left as free blocks.

## Result
| Facility | Hosts | Subnet | Usable range |
| --- | --- | --- | --- |
| AI Research Lab | 100 | 192.168.50.0/25 | .1 - .126 |
| IoT Prototyping Lab | 50 | 192.168.50.128/26 | .129 - .190 |
| Staff Administration Room | 20 | 192.168.50.192/27 | .193 - .222 |
| Core Server Room | 5 | 192.168.50.224/29 | .225 - .230 |

232 of 256 addresses used; 24 kept free (192.168.50.232/29 and 192.168.50.240/28).

## Screenshots
_Add screenshots from the docs/ folder here._

## Run it locally
Open `index.html` in a browser. No build step and no dependencies.

## Run the tests
`node tests/run.js`

## Files
- `logic.js` - the allocation algorithm (no page code)
- `app.js` - reads the inputs and draws the results
- `style.css` - the look
- `index.html` - the page
- `tests/run.js` - automated checks

## Team
_Add both names and roles here._
