const TILE_SIZE: i32 = 32;
const WORLD_WIDTH: usize = 96;
const WORLD_HEIGHT: usize = 64;
const WORLD_LEN: usize = WORLD_WIDTH * WORLD_HEIGHT;
const INVENTORY_LEN: usize = 8;
const ENTITY_LEN: usize = 3;

const TILE_GRASS: u8 = 0;
const TILE_PATH: u8 = 1;
const TILE_WATER: u8 = 2;
const TILE_FOREST: u8 = 3;
const TILE_MOUNTAIN: u8 = 4;
const TILE_SHRINE: u8 = 5;

const ENTITY_SHRINE: u8 = 5;
const ENTITY_RELIC: u8 = 6;
const ENTITY_SAGE: u8 = 7;

const ITEM_RIVER_SHELL: u8 = 1;
const ITEM_BRONZE_RELIC: u8 = 2;

const FACING_UP: u8 = 0;
const FACING_DOWN: u8 = 1;
const FACING_LEFT: u8 = 2;
const FACING_RIGHT: u8 = 3;

#[repr(C)]
#[derive(Copy, Clone)]
struct Entity {
    kind: u8,
    x: i32,
    y: i32,
    seen: u8,
}

impl Entity {
    const fn new(kind: u8, x: i32, y: i32) -> Self {
        Self {
            kind,
            x,
            y,
            seen: 0,
        }
    }
}

#[repr(C)]
struct Simulation {
    tiles: [u8; WORLD_LEN],
    player_x: i32,
    player_y: i32,
    facing: u8,
    dharma: i32,
    vitality: i32,
    inventory: [u8; INVENTORY_LEN],
    inventory_len: u8,
    entities: [Entity; ENTITY_LEN],
    dirty: u8,
}

impl Simulation {
    const fn empty() -> Self {
        Self {
            tiles: [0; WORLD_LEN],
            player_x: 0,
            player_y: 0,
            facing: FACING_DOWN,
            dharma: 52,
            vitality: 100,
            inventory: [0; INVENTORY_LEN],
            inventory_len: 0,
            entities: [Entity::new(0, 0, 0); ENTITY_LEN],
            dirty: 1,
        }
    }

    fn reset(&mut self) {
        let center_x = (WORLD_WIDTH / 2) as i32;
        let center_y = (WORLD_HEIGHT / 2) as i32;
        let shrine_x = center_x + 3;
        let shrine_y = center_y + 1;

        self.player_x = center_x - 8;
        self.player_y = center_y + 4;
        self.facing = FACING_DOWN;
        self.dharma = 52;
        self.vitality = 100;
        self.inventory = [0; INVENTORY_LEN];
        self.inventory[0] = ITEM_RIVER_SHELL;
        self.inventory_len = 1;
        self.entities = [
            Entity::new(ENTITY_SHRINE, shrine_x, shrine_y),
            Entity::new(ENTITY_RELIC, center_x - 6, center_y - 2),
            Entity::new(ENTITY_SAGE, center_x + 10, center_y + 5),
        ];

        for y in 0..WORLD_HEIGHT as i32 {
            for x in 0..WORLD_WIDTH as i32 {
                let mut tile = TILE_GRASS;
                let border =
                    x == 0 || y == 0 || x == WORLD_WIDTH as i32 - 1 || y == WORLD_HEIGHT as i32 - 1;
                let lake = (x - 18).abs() + (y - 15).abs() < 10
                    || (x > 75 && y < 18 && (x - 83).abs() + (y - 10).abs() < 12);
                let river_band =
                    (y as f32 - (center_y as f32 + (x as f32 / 8.0).sin() * 3.0)).abs() < 2.2;
                let forest_west = x < 18 && y > 30 && y < 52;
                let forest_east = x > 66 && y > 36 && y < 58;
                let path_a = (x > 12 && x < center_x + 2 && (y - (center_y + 2)).abs() <= 1)
                    || (y > 12 && y < center_y + 2 && (x - (center_x - 8)).abs() <= 1);
                let path_b = x > center_x - 2 && x < shrine_x + 10 && (y - shrine_y).abs() <= 1;

                if border {
                    tile = TILE_MOUNTAIN;
                } else if lake || river_band {
                    tile = TILE_WATER;
                } else if forest_west || forest_east {
                    tile = TILE_FOREST;
                } else if path_a || path_b {
                    tile = TILE_PATH;
                } else if (x - shrine_x).abs() <= 1 && (y - shrine_y).abs() <= 1 {
                    tile = TILE_SHRINE;
                }

                self.tiles[(y as usize) * WORLD_WIDTH + x as usize] = tile;
            }
        }

        self.dirty = 1;
    }

    fn tile_at(&self, x: i32, y: i32) -> u8 {
        if x < 0 || y < 0 || x >= WORLD_WIDTH as i32 || y >= WORLD_HEIGHT as i32 {
            return TILE_MOUNTAIN;
        }
        self.tiles[(y as usize) * WORLD_WIDTH + x as usize]
    }

    fn can_walk(&self, x: i32, y: i32) -> bool {
        !matches!(self.tile_at(x, y), TILE_WATER | TILE_MOUNTAIN)
    }

    fn add_item(&mut self, item: u8) {
        if self.inventory[..self.inventory_len as usize].contains(&item) {
            return;
        }
        if (self.inventory_len as usize) < INVENTORY_LEN {
            self.inventory[self.inventory_len as usize] = item;
            self.inventory_len += 1;
        }
    }

    fn find_entity(&self, kind: u8) -> i32 {
        self.entities
            .iter()
            .position(|entity| entity.kind == kind)
            .map(|idx| idx as i32)
            .unwrap_or(-1)
    }

    fn interact(&mut self) -> i32 {
        for entity in &mut self.entities {
            let close =
                (entity.x - self.player_x).abs() <= 1 && (entity.y - self.player_y).abs() <= 1;
            if !close {
                continue;
            }

            match entity.kind {
                ENTITY_SHRINE => {
                    self.dharma = (self.dharma + 12).min(100);
                    self.vitality = (self.vitality + 6).min(100);
                    return 1;
                }
                ENTITY_RELIC if entity.seen == 0 => {
                    entity.seen = 1;
                    self.add_item(ITEM_BRONZE_RELIC);
                    self.dharma = (self.dharma + 4).min(100);
                    return 2;
                }
                ENTITY_SAGE => {
                    return 3;
                }
                _ => {}
            }
        }
        0
    }
}

static mut SIM: Simulation = Simulation::empty();

#[allow(static_mut_refs)]
fn sim() -> &'static mut Simulation {
    unsafe { &mut SIM }
}

#[no_mangle]
pub extern "C" fn init_world() {
    sim().reset();
}

#[no_mangle]
pub extern "C" fn world_width() -> i32 {
    WORLD_WIDTH as i32
}

#[no_mangle]
pub extern "C" fn world_height() -> i32 {
    WORLD_HEIGHT as i32
}

#[no_mangle]
pub extern "C" fn tile_size() -> i32 {
    TILE_SIZE
}

#[no_mangle]
pub extern "C" fn get_tile(x: i32, y: i32) -> i32 {
    sim().tile_at(x, y) as i32
}

#[no_mangle]
pub extern "C" fn player_x() -> i32 {
    sim().player_x
}

#[no_mangle]
pub extern "C" fn player_y() -> i32 {
    sim().player_y
}

#[no_mangle]
pub extern "C" fn player_facing() -> i32 {
    sim().facing as i32
}

#[no_mangle]
pub extern "C" fn player_dharma() -> i32 {
    sim().dharma
}

#[no_mangle]
pub extern "C" fn player_vitality() -> i32 {
    sim().vitality
}

#[no_mangle]
pub extern "C" fn inventory_len() -> i32 {
    sim().inventory_len as i32
}

#[no_mangle]
pub extern "C" fn inventory_item(index: i32) -> i32 {
    let index = index as usize;
    if index >= sim().inventory_len as usize {
        0
    } else {
        sim().inventory[index] as i32
    }
}

#[no_mangle]
pub extern "C" fn entity_count() -> i32 {
    ENTITY_LEN as i32
}

#[no_mangle]
pub extern "C" fn entity_kind(index: i32) -> i32 {
    let index = index as usize;
    if index >= ENTITY_LEN {
        0
    } else {
        sim().entities[index].kind as i32
    }
}

#[no_mangle]
pub extern "C" fn entity_x(index: i32) -> i32 {
    let index = index as usize;
    if index >= ENTITY_LEN {
        0
    } else {
        sim().entities[index].x
    }
}

#[no_mangle]
pub extern "C" fn entity_y(index: i32) -> i32 {
    let index = index as usize;
    if index >= ENTITY_LEN {
        0
    } else {
        sim().entities[index].y
    }
}

#[no_mangle]
pub extern "C" fn entity_seen(index: i32) -> i32 {
    let index = index as usize;
    if index >= ENTITY_LEN {
        0
    } else {
        sim().entities[index].seen as i32
    }
}

#[no_mangle]
pub extern "C" fn find_entity(kind: i32) -> i32 {
    sim().find_entity(kind as u8)
}

#[no_mangle]
pub extern "C" fn set_player_position(x: i32, y: i32) {
    sim().player_x = x;
    sim().player_y = y;
}

#[no_mangle]
pub extern "C" fn move_player(dx: i32, dy: i32) -> i32 {
    let next_x = sim().player_x + dx;
    let next_y = sim().player_y + dy;
    if !sim().can_walk(next_x, next_y) {
        return 0;
    }

    sim().player_x = next_x;
    sim().player_y = next_y;
    if dx < 0 {
        sim().facing = FACING_LEFT;
    } else if dx > 0 {
        sim().facing = FACING_RIGHT;
    } else if dy < 0 {
        sim().facing = FACING_UP;
    } else if dy > 0 {
        sim().facing = FACING_DOWN;
    }
    1
}

#[no_mangle]
pub extern "C" fn interact() -> i32 {
    sim().interact()
}
