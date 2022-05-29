import { INVALID_MOVE } from "boardgame.io/core";
import { Ctx } from "boardgame.io";

export const GAME_ID = "emu-bay-railway-company-3";

enum CompanyID {
    EB = 0,
    TMLC,
    LW,
    GT,
    MLM,
    NED,
    NMF,
}

export interface IBond {
    deferred: boolean;
    baseInterest: number;
    interestDelta: number;
    amount: number;
}

interface IPlayer {
    cash: number;
}

export interface ICoordinates {
    x: number;
    y: number;
}

interface ITrackBuilt extends ICoordinates {
    owner?: CompanyID;
    narrow: boolean;
}

export enum CompanyType {
    Major,
    Minor,
}

interface ICompany {
    cash: number;
    trainsRemaining: number;
    narrowGaugeRemaining: number;
    resourcesHeld: number;
    currentRevenue: number;
    bonds: IBond[];
    sharesHeld: number[];
    sharesRemaining: number;
    reservedSharesRemaining: number;
    home?: ICoordinates;
    independentsOwned: ICompany[];
    companyType: CompanyType;
    open: boolean;
    id: number;
}

export interface IEmuBayState {
    players: IPlayer[];
    companies: ICompany[];
    actionCubeLocations: boolean[];
    actionCubeTakenFrom?: actions | null;
    resourceCubes: ICoordinates[];
    track: ITrackBuilt[];
    currentBid?: number;
    winningBidder?: number;
    companyForAuction?: CompanyID;
    passed?: boolean[];
    playerAfterPhase?: number;
    playerInitialBidder?: number;
    auctionFinished?: boolean;
    anyActionsTaken?: boolean;
    buildsRemaining?: number;
    independentOrder: CompanyID[];
    mineLocation?: ICoordinates | null;
    bonds: IBond[];
    toAct?: CompanyID;
    pseudoStage?: PseudoStage | null;
    pseudoPhase?: PseudoPhase;
    firstTurnOfPhase?: boolean;
    firstPlayerOfPhase?: number;
    turnLog: string[]; // Don't know if this is wise or not (memory wise) but it's here for now
}

export enum PseudoStage {
    removeCube,
    takeAction,
    buildingTrack,
    takeResources,
}

export enum PseudoPhase {
    InitialAuction,
    NormalPlay,
    Auction,
}

export enum EndGameReason {
    quit,
    stalemate,
    bankruptcy,
    shares,
    bonds,
    track,
    resource,
}
export interface IEndgameState {
    reasons: EndGameReason[];
    scores: { player: number; cash: number }[];
    winner: number[];
}
export interface ILocation extends ICoordinates {
    label?: string;
}

interface ITerrain {
    // What else could I call it?
    biomeName: string;
    canPlaceResource: boolean;
    firstCost: number;
    secondCost: number | null;
    revenue: (gamestate: IEmuBayState, buildmode: BuildMode) => number;
    textureIndex: number;
    locations: ILocation[];
}

const fixedNarrowRevenue = 3;

function getTileBiome(tile: ICoordinates): ITerrain | undefined {
    return MAP.find((T) => {
        return (
            T.locations.find((xy) => xy.x == tile.x && xy.y == tile.y) !=
            undefined
        );
    });
}

// This should be generatable, or compatible with 18xxMaker or something
export const MAP: ITerrain[] = [
    {
        biomeName: "Farmland",
        canPlaceResource: false,
        firstCost: 4,
        secondCost: 8,
        revenue: (G: IEmuBayState, B: BuildMode) => {
            if (B == BuildMode.Normal) {
                // Is town present?
                let owned = G.track.filter((i) => i.owner == G.toAct);
                let biomes = owned.map((i) => getTileBiome(i));
                let anyTowns =
                    biomes.find((i) => i?.biomeName == "Town") != undefined;
                return anyTowns ? 2 : 0;
            } else {
                return fixedNarrowRevenue;
            }
        },
        textureIndex: 0,
        locations: [
            { x: 1, y: 1 },
            { x: 3, y: 2 },
            { x: 3, y: 3 },
            { x: 4, y: 2 },
            { x: 5, y: 3 },
            { x: 6, y: 1 },
            { x: 6, y: 2 },
            { x: 6, y: 3 },
            { x: 6, y: 4 },
            { x: 6, y: 5 },
            { x: 7, y: 2 },
            { x: 7, y: 4 },
            { x: 7, y: 5 },
            { x: 7, y: 6 },
            { x: 8, y: 3 },
            { x: 8, y: 4 },
            { x: 8, y: 5 },
            { x: 8, y: 6 },
        ],
    },

    {
        biomeName: "Port",
        canPlaceResource: false,
        firstCost: 6,
        secondCost: 10,
        revenue: (G: IEmuBayState, B: BuildMode) => {
            if (B == BuildMode.Normal) {
                if (!connectedToPort(G, G.toAct!)) {
                    // First connection to port = all resource cubes paying more
                    return firstPortConnectionRev(G, G.toAct!);
                } else {
                    return 0;
                }
            } else {
                if (!connectedToPort(G, G.toAct!)) {
                    return (
                        firstPortConnectionRev(G, G.toAct!) + fixedNarrowRevenue
                    );
                } else {
                    return fixedNarrowRevenue;
                }
            }
        },
        textureIndex: 3,
        locations: [
            { x: 1, y: 4, label: "Port of Strahan" },
            { x: 4, y: 1, label: "Port of Burnie" },
            { x: 5, y: 1, label: "Port of Devenport" },
            { x: 7, y: 8, label: "Port of Hobart" },
        ],
    },

    {
        biomeName: "Forest",
        canPlaceResource: true,
        firstCost: 4,
        secondCost: null,
        revenue: (G: IEmuBayState, B: BuildMode) => {
            if (B == BuildMode.Normal) {
                return 1;
            } else {
                return fixedNarrowRevenue;
            }
        },
        textureIndex: 1,
        locations: [
            { x: 1, y: 2 },
            { x: 1, y: 3 },
            { x: 2, y: 1 },
            { x: 2, y: 3 },
            { x: 2, y: 4 },
            { x: 2, y: 5 },
            { x: 3, y: 7 },
            { x: 4, y: 3 },
            { x: 4, y: 8 },
            { x: 5, y: 4 },
            { x: 5, y: 5 },
            { x: 6, y: 6 },
            { x: 6, y: 7 },
            { x: 6, y: 8 },
            { x: 8, y: 1 },
            { x: 8, y: 2 },
            { x: 9, y: 1 },
            { x: 9, y: 2 },
            { x: 9, y: 3 },
            { x: 9, y: 4 },
        ],
    },

    {
        biomeName: "Mountain",
        canPlaceResource: true,
        firstCost: 10,
        secondCost: null,
        revenue: (G: IEmuBayState, B: BuildMode) => {
            if (B == BuildMode.Normal) {
                return 2;
            } else {
                return fixedNarrowRevenue;
            }
        },
        textureIndex: 4,
        locations: [
            { x: 2, y: 2 },
            { x: 3, y: 4 },
            { x: 3, y: 5 },
            { x: 3, y: 6 },
            { x: 4, y: 4 },
            { x: 4, y: 5 },
            { x: 4, y: 6 },
            { x: 4, y: 7 },
            { x: 5, y: 6 },
            { x: 5, y: 7 },
            { x: 5, y: 8 },
        ],
    },

    {
        biomeName: "Town",
        canPlaceResource: false,
        firstCost: 6,
        secondCost: 10,
        revenue: (G: IEmuBayState, B: BuildMode) => {
            if (B == BuildMode.Normal) {
                let owned = G.track.filter((i) => i.owner == G.toAct);
                let biomes = owned.map((i) => getTileBiome(i));
                let towns = biomes.filter((i) => i?.biomeName == "Town");
                let townRev = [2, 4, 6][towns.length];

                // If first town, check if any farmland needs to increase
                let extraFarmRevenue = 0;
                if (towns.length == 0) {
                    let farmsWithTrack = G.track
                        .filter((i) => i.owner == G.toAct)
                        .filter(
                            (i) => getTileBiome(i!)?.biomeName == "Farmland"
                        ).length;
                    extraFarmRevenue = farmsWithTrack * 2;
                }

                return extraFarmRevenue + townRev;

                // TODO: Change to return depending on amount of towns connected
            } else {
                return fixedNarrowRevenue;
            }
        },
        textureIndex: 2,
        locations: [
            { x: 5, y: 2, label: "Devenport" },
            { x: 7, y: 3, label: "Launceston" },
            { x: 7, y: 7, label: "Hobart" },
        ],
    },
];

const STARTING_CASH = 24;

export enum actions {
    BuildTrack,
    AuctionShare,
    TakeResources,
    IssueBond,
    Merge,
    PayDividend,
}

export const ACTION_CUBE_LOCATION_ACTIONS = [
    actions.BuildTrack,
    actions.BuildTrack,
    actions.BuildTrack,
    actions.AuctionShare,
    actions.AuctionShare,
    actions.TakeResources,
    actions.TakeResources,
    actions.TakeResources,
    actions.IssueBond,
    actions.Merge,
    actions.PayDividend,
];

export function getMinimumBid(G: IEmuBayState, company: number) {
    var sharesHeldCount = G.companies[company].sharesHeld.length + 1;
    return Math.max(
        1,
        Math.ceil(G.companies[company].currentRevenue / sharesHeldCount)
    );
}

function initialAuctionCompanyWon(G: IEmuBayState, ctx: Ctx) {
    G.players[G.winningBidder!].cash -= G.currentBid!;
    G.companies[G.companyForAuction!].cash += G.currentBid!;
    G.companies[G.companyForAuction!].sharesHeld.push(G.winningBidder!);
    G.companies[G.companyForAuction!].sharesRemaining -= 1;
    G.turnLog.push(
        `!%C${G.companyForAuction} won by %P${G.winningBidder} for ₤${G.currentBid}`
    );

    var auctionNumber = InitialAuctionOrder.indexOf(G.companyForAuction!);
    if (auctionNumber + 1 < InitialAuctionOrder.length) {
        G.companyForAuction = InitialAuctionOrder[auctionNumber + 1];
        G.currentBid = 0;
        G.passed = new Array(ctx.numPlayers).fill(false);
        G.turnLog.push(`!%C${G.companyForAuction} for auction`);
        ctx.events!.endTurn!({ next: G.winningBidder!.toString() });
        return;
    }
    G.playerAfterPhase = G.companies[CompanyID.GT].sharesHeld[0];
    G.auctionFinished = true;
    StartPhase(PseudoPhase.NormalPlay, G, ctx);
}

// More copy paste than there should be
function auctionCompanyWon(G: IEmuBayState, ctx: Ctx) {
    G.players[G.winningBidder!].cash -= G.currentBid!;
    G.companies[G.companyForAuction!].cash += G.currentBid!;
    G.companies[G.companyForAuction!].sharesHeld.push(G.winningBidder!);
    G.companies[G.companyForAuction!].open = true;
    G.companies[G.companyForAuction!].sharesRemaining -= 1;
    G.turnLog.push(
        `!%C${G.companyForAuction} won by %P${G.winningBidder} for ₤${G.currentBid}`
    );
    G.auctionFinished = true;
    // Make the next independent available
    if (G.companies[G.companyForAuction!].companyType == CompanyType.Minor) {
        G.independentOrder.splice(0, 1);
    }
    StartPhase(PseudoPhase.NormalPlay, G, ctx);
    ctx.events!.endTurn!({ next: G.playerAfterPhase!.toString() });
}

function jiggleCubes(G: IEmuBayState, actionToTake: actions): string | void {
    if (G.actionCubeTakenFrom == actionToTake) {
        console.log("Must take different action to removed action cube");
        return INVALID_MOVE;
    }
    var availableSpaces = ACTION_CUBE_LOCATION_ACTIONS.map((v, i) => ({
        value: v,
        idx: i,
    }))
        .filter((v) => v.value == actionToTake)
        .filter((v) => G.actionCubeLocations[v.idx] == false);
    if (availableSpaces.length == 0) {
        console.log("No action spaces available");
        return INVALID_MOVE;
    }
    G.actionCubeLocations[availableSpaces[0].idx] = true;
}

export function resourceCubeCost(G: IEmuBayState): number {
    // Putting here to make easy to change into formula if I wish later
    return 3;
}

export function resourceCubeRevenue(G: IEmuBayState, company: number): number {
    // Maybe this should be in Game too...
    if (connectedToPort(G, company)) {
        return 3;
    } else {
        return 1;
    }
}

function firstPortConnectionRev(G: IEmuBayState, company: number): number {
    return G.companies[company].resourcesHeld * 2;
}

function connectedToPort(G: IEmuBayState, company: number): boolean {
    // Connected if one of the companies tracks, or a narrow gauge
    // connected to company owned station

    // Simple first
    let ports = MAP.find((i) => i.biomeName == "Port")!.locations!;
    let accessibleTrack = companyAccessibleTrack(G, company);
    let coTrackOnPort =
        ports.find(
            (i) =>
                accessibleTrack.find((t) => t.x == i.x && t.y == i.y) !=
                undefined
        ) != undefined;
    if (coTrackOnPort) {
        return true;
    }

    // Now the annoying narrow gauge one
    return false;
}

function companyAccessibleTrack(
    G: IEmuBayState,
    company: number
): ICoordinates[] {
    // Returning the companies tracks, and the connected narrowgauge tracks

    // Company
    let coTracks: ICoordinates[] = G.track.filter(
        (t) => t.owner == company && !t.narrow
    );

    // Annoying narrow
    let connectedNarrow: ICoordinates[] = [];
    if (company < 3) {
        connectedNarrow.push(
            ...G.companies[company].independentsOwned.map((i) => i.home!)
        );
    } else {
        connectedNarrow.push(G.companies[company].home!);
    }
    let toCheck: ICoordinates[] = [];
    toCheck = toCheck.concat(...connectedNarrow.map((i) => getAdjacent(i)));

    let allNarrow = G.track.filter((t) => t.narrow);

    while (toCheck.length > 0) {
        let checking = toCheck.pop()!;
        if (
            connectedNarrow.find((i) => i.x == checking.x && i.y == checking.y)
        ) {
            // already visited
            break;
        }

        if (allNarrow.find((i) => i.x == checking.x && i.y == checking.y)) {
            // Found - so can connect to others nearby
            connectedNarrow.push(checking);
            toCheck.push(...getAdjacent(checking));

            // Don't think efficiency wise worth looping through AGAIN to check if it's
            // already there. May do maths later if proves an issue.
        }
    }

    return coTracks.concat(connectedNarrow);
}

export enum BuildMode {
    Normal,
    Narrow,
}

export interface IBuildableSpace extends ICoordinates {
    cost: number;
    rev: number;
}

export function getAllowedBuildSpaces(
    G: IEmuBayState,
    buildmode: BuildMode,
    company: number
): IBuildableSpace[] {
    // Get all buildable spaces
    let buildableSpaces: IBuildableSpace[] = [];

    MAP.forEach((biome) => {
        if (!biome.firstCost) {
            // Can't build
            return;
        }
        biome.locations.forEach((i) => {
            let tracks = G.track.filter((t) => i.x == t.x && i.y == t.y);
            let homes = G.companies
                .map((co, idx) => ({ co: co, idx: idx }))
                .filter((t) => t.co.home?.x == i.x && t.co.home?.y == i.y);
            let count = tracks.length + homes.length;

            // Check for already containing relevant home/track
            if (buildmode == BuildMode.Normal) {
                if (
                    homes.find((i) => i.idx == G.toAct) ||
                    tracks.find((i) => i.owner == G.toAct)
                ) {
                    return;
                }
            } else {
                // IN FUTURE GAME, THIS MIGHT NEED TO CHECK IF HOME STATION IS PRESENT FOR PRIVATE
                if (tracks.find((i) => i.narrow)) {
                    return;
                }
            }

            if (count > 0 && !biome.secondCost) {
                return; // Already full
            }

            let cost = count == 0 ? biome.firstCost : biome.secondCost;

            if (cost! > G.companies[company].cash) {
                return; // Not enough cash
            }

            if (
                buildmode == BuildMode.Normal &&
                G.companies[company].trainsRemaining == 0
            ) {
                return;
            }
            if (
                buildmode == BuildMode.Narrow &&
                G.companies[company].narrowGaugeRemaining == 0
            ) {
                return;
            }

            // Check for adjacency
            if (buildmode == BuildMode.Normal) {
                let adjacent = getAdjacent(i);
                if (
                    !adjacent.find((i) => {
                        let tracks = G.track.filter(
                            (t) => i.x == t.x && i.y == t.y
                        );
                        let homes = G.companies
                            .map((co, idx) => ({ co: co, idx: idx }))
                            .filter(
                                (t) =>
                                    t.co.home?.x == i.x && t.co.home?.y == i.y
                            );
                        return (
                            tracks.find((i) => i.owner == G.toAct) ||
                            homes.find((i) => i.idx == G.toAct)
                        );
                    })
                ) {
                    //  None are adjacent, return
                    return;
                }
            } else {
                // Need to check not only adjacent to narrow, but also connected to relevant home
                let relevantHomes: ICoordinates[];
                if (company > 2) {
                    // Independent
                    relevantHomes = [G.companies[company].home!];
                } else {
                    // Must have merged in. Need connection to one of its privates
                    relevantHomes = G.companies[company].independentsOwned!.map(
                        (i) => i.home!
                    );
                }

                // This should be cached - a fair bit of repetition happening here.
                let visited: ICoordinates[] = [];
                let toCheck = getAdjacent(i);
                let connected = false;

                while (!connected && toCheck.length > 0) {
                    let checking = toCheck.pop()!;
                    if (
                        visited.some(
                            (i) => i.x == checking.x && i.y == checking.y
                        )
                    ) {
                        // already visited
                        continue;
                    }
                    visited.push(checking);

                    if (
                        relevantHomes.find(
                            (i) => i.x == checking.x && i.y == checking.y
                        )
                    ) {
                        connected = true;
                        break;
                    }

                    let hasTrack = G.track.find(
                        (i) =>
                            i.x == checking.x && i.y == checking.y && i.narrow
                    );
                    if (!hasTrack) {
                        // No track - can't help connect (but could be available)
                        continue;
                    }

                    toCheck.push(...getAdjacent(checking));
                }

                if (!connected) {
                    return;
                }
            }

            let revenue = biome.revenue(G, buildmode);

            buildableSpaces.push({
                x: i.x,
                y: i.y,
                cost: cost!,
                rev: revenue!,
            });
        });
    });

    return buildableSpaces;
}

export function getTakeResourceSpaces(
    G: IEmuBayState,
    company: number
): ICoordinates[] {
    if (G.companies[company].cash < resourceCubeCost(G)) {
        // Doing this here too - can't build if no cash to do it (and simplify board)
        // code in the process
        return [];
    }

    let accessible = companyAccessibleTrack(G, company);

    // Can only mine one space in the turn
    if (G.mineLocation != null) {
        accessible = [G.mineLocation!];
    }

    return accessible.filter((t) =>
        G.resourceCubes.some((r) => r.x == t.x && r.y == t.y)
    );
}

interface IMergable {
    major: number;
    minor: number;
}

export function getMergableCompanies(G: IEmuBayState, ctx: Ctx): IMergable[] {
    // All major minor combinations
    let possibilities: IMergable[] = [];
    for (let maj = 0; maj < G.companies.length; ++maj) {
        if (G.companies[maj].companyType == CompanyType.Major) {
            for (let min = 0; min < G.companies.length; ++min) {
                if (
                    G.companies[min].companyType == CompanyType.Minor &&
                    G.companies[min].open
                ) {
                    possibilities.push({ major: maj, minor: min });
                }
            }
        }
    }

    // Must own at least one share in one
    possibilities = possibilities
        .filter(
            (i) =>
                G.companies[i.major].sharesHeld.find(
                    (i) => i == +ctx.currentPlayer
                ) != undefined ||
                G.companies[i.minor].sharesHeld.find(
                    (i) => i == +ctx.currentPlayer
                ) != undefined
        )
        // TODO: Limit to companies that have enough shares to merge
        .filter(
            (i) =>
                G.companies[i.major].sharesRemaining > 0 ||
                G.companies[i.major].reservedSharesRemaining > 0
        )
        // TODO: Limit to companies that are connected
        .filter((i) => {
            let minor = G.companies[i.minor];
            let coTracks: ICoordinates[] = G.track.filter(
                (t) => t!.owner! == i.major && !t.narrow
            );
            let narrowTracks: ICoordinates[] = G.track.filter((t) => t.narrow);
            let visited: ICoordinates[] = [];
            let toCheck = [minor.home];
            while (toCheck.length > 0) {
                var Z = toCheck.pop()!;
                if (visited.some((i) => Z.x == i.x && Z.y == i.y)) {
                    // Already visited
                    continue;
                }
                visited.push(Z);
                if (coTracks.some((i) => Z.x == i.x && Z.y == i.y)) {
                    // Connected!
                    return true;
                }
                if (narrowTracks.some((i) => Z.x == i.x && Z.y == i.y)) {
                    toCheck.push(...getAdjacent(Z));
                }
            }
            return false;
        });
    return possibilities;
}

export const InitialAuctionOrder = [
    CompanyID.LW,
    CompanyID.TMLC,
    CompanyID.EB,
    CompanyID.GT,
];

const IndependentStartingRevenue = 3;

function CompanyInitialState(): ICompany[] {
    return [
        {
            // EB
            cash: 0,
            trainsRemaining: 4,
            narrowGaugeRemaining: 0,
            resourcesHeld: 0,
            currentRevenue: 1,
            bonds: [],
            sharesHeld: [],
            sharesRemaining: 2,
            reservedSharesRemaining: 4,
            home: { x: 2, y: 3 },
            independentsOwned: [],
            companyType: CompanyType.Major,
            open: true,
            id: 0,
        },
        {
            // TMLC
            cash: 0,
            trainsRemaining: 8,
            narrowGaugeRemaining: 0,
            resourcesHeld: 0,
            currentRevenue: 2,
            bonds: [],
            sharesHeld: [],
            sharesRemaining: 4,
            reservedSharesRemaining: 0,
            home: { x: 7, y: 3 },
            independentsOwned: [],
            companyType: CompanyType.Major,
            open: true,
            id: 1,
        },
        {
            // LW
            cash: 0,
            trainsRemaining: 7,
            narrowGaugeRemaining: 0,
            resourcesHeld: 0,
            currentRevenue: 2,
            bonds: [],
            sharesHeld: [],
            sharesRemaining: 3,
            reservedSharesRemaining: 0,
            home: { x: 7, y: 3 },
            independentsOwned: [],
            companyType: CompanyType.Major,
            open: true,
            id: 2,
        },
        {
            // GT
            cash: 10,
            trainsRemaining: 0,
            narrowGaugeRemaining: 2,
            resourcesHeld: 0,
            currentRevenue: IndependentStartingRevenue,
            bonds: [
                {
                    deferred: true,
                    amount: 10,
                    baseInterest: 3,
                    interestDelta: 1,
                },
            ],
            sharesHeld: [],
            sharesRemaining: 1,
            reservedSharesRemaining: 0,
            independentsOwned: [],
            companyType: CompanyType.Minor,
            open: true,
            id: 3,
        },
        {
            // MLM
            cash: 15,
            trainsRemaining: 0,
            narrowGaugeRemaining: 3,
            resourcesHeld: 0,
            currentRevenue: IndependentStartingRevenue,
            bonds: [
                {
                    deferred: true,
                    amount: 15,
                    baseInterest: 4,
                    interestDelta: 1,
                },
            ],
            sharesHeld: [],
            sharesRemaining: 1,
            reservedSharesRemaining: 0,
            independentsOwned: [],
            companyType: CompanyType.Minor,
            open: false,
            id: 4,
        },
        {
            // NED
            cash: 15,
            trainsRemaining: 0,
            narrowGaugeRemaining: 3,
            resourcesHeld: 0,
            currentRevenue: IndependentStartingRevenue,
            bonds: [
                {
                    deferred: true,
                    amount: 15,
                    baseInterest: 6,
                    interestDelta: 1,
                },
            ],
            sharesHeld: [],
            sharesRemaining: 1,
            reservedSharesRemaining: 0,
            independentsOwned: [],
            companyType: CompanyType.Minor,
            open: false,
            id: 5,
        },
        {
            // NMF
            cash: 15,
            trainsRemaining: 0,
            narrowGaugeRemaining: 4,
            resourcesHeld: 0,
            currentRevenue: IndependentStartingRevenue,
            bonds: [
                {
                    deferred: true,
                    amount: 15,
                    baseInterest: 7,
                    interestDelta: 1,
                },
            ],
            sharesHeld: [],
            sharesRemaining: 1,
            reservedSharesRemaining: 0,
            independentsOwned: [],
            companyType: CompanyType.Minor,
            open: false,
            id: 6,
        },
    ];
}

function initialAvailableBonds(): IBond[] {
    return [
        { deferred: true, amount: 10, baseInterest: 6, interestDelta: 1 },
        { deferred: true, amount: 20, baseInterest: 7, interestDelta: 2 },
        { deferred: true, amount: 20, baseInterest: 8, interestDelta: 2 },
        { deferred: true, amount: 30, baseInterest: 9, interestDelta: 2 },
        { deferred: true, amount: 30, baseInterest: 10, interestDelta: 2 },
    ];
}

// Bonds that are randomly given to the 3 companies
function startingBonds(): IBond[] {
    return [
        { deferred: true, amount: 0, baseInterest: 0, interestDelta: 0 },
        { deferred: true, amount: 10, baseInterest: 5, interestDelta: 1 },
        { deferred: true, amount: 15, baseInterest: 5, interestDelta: 2 },
    ];
}

const SETUP_CARDS = [
    // C N NE SE S SW NW
    // Cube = 1
    // Station = 2
    [[1, 2], [1, 1], [], [1], [], [], []],
    [[2], [1], [1], [], [], [], []],
    [[2], [], [1, 1], [], [], [1], []],
    [[1, 1, 1, 2], [], [], [], [], [], []],
    [[1], [], [], [], [], [1], []],
    [[1], [1], [], [], [], [], [1]],
    [[1], [1], [], [], [], [], []],
    [[], [], [1], [], [1], [], []],
];

const SETUP_POINTS: ICoordinates[] = [
    { x: 2, y: 2 },
    { x: 3, y: 4 },
    { x: 3, y: 5 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
    { x: 5, y: 8 },
    { x: 9, y: 1 },
    { x: 9, y: 3 },
];

function getAdjacent(xy: ICoordinates): ICoordinates[] {
    // Get points adjacent to point
    if (xy.x % 2 == 0) {
        // Even x
        return [
            { x: xy.x, y: xy.y - 1 },
            { x: xy.x + 1, y: xy.y },
            { x: xy.x + 1, y: xy.y + 1 },
            { x: xy.x, y: xy.y + 1 },
            { x: xy.x - 1, y: xy.y + 1 },
            { x: xy.x - 1, y: xy.y },
        ];
    } else {
        // Odd x
        return [
            { x: xy.x, y: xy.y - 1 },
            { x: xy.x + 1, y: xy.y - 1 },
            { x: xy.x + 1, y: xy.y },
            { x: xy.x, y: xy.y + 1 },
            { x: xy.x - 1, y: xy.y },
            { x: xy.x - 1, y: xy.y - 1 },
        ];
    }
}

export function stalemateAvailable(G: IEmuBayState, ctx: Ctx): boolean {
    var anyAvailable = ACTION_CUBE_LOCATION_ACTIONS.map((v, i) => ({
        value: v,
        idx: i,
    }))
        .filter((v) => G.actionCubeLocations[v.idx] == false)
        .map((i) => ACTION_CUBE_LOCATION_ACTIONS[i.idx])
        .reduce<actions[]>(
            (last, i) => (last.includes(i) ? last : last.concat(i)),
            []
        )
        .some((i) => {
            switch (i) {
                case actions.AuctionShare:
                    return G.companies
                        .map((v, i) => ({ value: v, idx: i }))
                        .some((c) => {
                            // If a public company, or private but next, and share available - list
                            if (
                                getMinimumBid(G, c.idx) >
                                G.players[+ctx.currentPlayer].cash
                            ) {
                                return false;
                            }
                            if (c.value.sharesRemaining == 0) {
                                return false;
                            }
                            if (
                                c.value.companyType == CompanyType.Minor &&
                                (G.independentOrder.length == 0 ||
                                    c.idx != G.independentOrder[0])
                            ) {
                                return false;
                            }
                            return true;
                        });

                case actions.BuildTrack:
                    return G.companies
                        .map((v, i) => ({ value: v, idx: i }))
                        .some((c) => {
                            if (
                                c.value.trainsRemaining == 0 &&
                                c.value.narrowGaugeRemaining == 0
                            ) {
                                return false;
                            }
                            // Check if any buildable spaces
                            if (
                                getAllowedBuildSpaces(
                                    G,
                                    BuildMode.Narrow,
                                    c.idx
                                ).length +
                                    getAllowedBuildSpaces(
                                        G,
                                        BuildMode.Normal,
                                        c.idx
                                    ).length ==
                                0
                            ) {
                                return false;
                            }
                            if (
                                c.value.sharesHeld.filter(
                                    (player) => player == +ctx.currentPlayer
                                ).length > 0
                            ) {
                                return true;
                            }
                            return false;
                        });
                    break;

                case actions.IssueBond:
                    let available =
                        G.companies
                            .map((v, i) => ({ value: v, idx: i }))
                            .some((c) => {
                                // Have to have share, has to not be private
                                if (c.idx >= 3) {
                                    return false;
                                }
                                if (
                                    c.value.sharesHeld.filter(
                                        (player) => player == +ctx.currentPlayer
                                    ).length > 0
                                ) {
                                    return true;
                                }
                                return false;
                            }) && G.bonds.length > 0;
                    break;

                case actions.Merge:
                    return getMergableCompanies(G, ctx).length > 0;

                case actions.PayDividend:
                    // Always chooseable if space is available
                    return true;

                case actions.TakeResources:
                    return G.companies
                        .map((v, i) => ({ value: v, idx: i }))
                        .some((c) => {
                            if (
                                c.value.sharesHeld.filter(
                                    (player) => player == +ctx.currentPlayer
                                ).length == 0
                            ) {
                                return false;
                            }
                            if (getTakeResourceSpaces(G, c.idx).length == 0) {
                                return false;
                            }
                            return true;
                        });
            }
        });
    return !anyAvailable;
}

function getEndgameState(
    G: IEmuBayState,
    reason: EndGameReason[]
): IEndgameState {
    let sortedScores = G.players
        .map((i, idx) => ({ player: idx, cash: i.cash }))
        .sort((a, b) => b.cash - a.cash);
    let winners: number[] = [];
    if (sortedScores[0].cash >= 0) {
        // If all negative, NO WINNER!
        // This filter is to allow draws
        winners = sortedScores
            .filter((i) => i.cash == sortedScores[0].cash)
            .map((i) => i.player);
    }
    return { reasons: reason, scores: sortedScores, winner: winners };
}

export function activeEndGameConditions(G: IEmuBayState): EndGameReason[] {
    let reasons: EndGameReason[] = [];

    if (G.companies.every((i) => i.sharesRemaining == 0)) {
        reasons.push(EndGameReason.shares);
    }

    if (G.bonds.length <= 2) {
        reasons.push(EndGameReason.bonds);
    }

    var majorsWithoutTrack = G.companies
        .filter((i) => i.companyType == CompanyType.Major)
        .filter((i) => i.trainsRemaining + i.narrowGaugeRemaining == 0).length;
    var minorHasNoTrack =
        G.companies
            .filter((i) => i.companyType == CompanyType.Minor)
            .reduce<number>((last, i) => last + i.narrowGaugeRemaining, 0) == 0;
    var chartersWithoutTrack = majorsWithoutTrack + (minorHasNoTrack ? 1 : 0);
    if (chartersWithoutTrack >= 3) {
        reasons.push(EndGameReason.track);
    }

    if (G.resourceCubes.length <= 3) {
        reasons.push(EndGameReason.resource);
    }

    return reasons;
}

function StartPhase(phase: PseudoPhase, G: IEmuBayState, ctx: Ctx) {
    // This should be removed when the boardgame.io phase bug is fixed
    G.pseudoPhase = phase;
    G.firstTurnOfPhase = true;
    switch (phase) {
        case PseudoPhase.InitialAuction:
            G.companyForAuction = CompanyID.LW;
            G.passed = new Array(ctx.numPlayers).fill(false);
            G.currentBid = 0;
            G.winningBidder = 0;
            G.auctionFinished = false;
            G.firstPlayerOfPhase = Math.floor(
                ctx.random!.Number() * ctx.numPlayers
            );
            G.turnLog.push("!Initial auction starting");
            G.turnLog.push(`!First player: %P${G.firstPlayerOfPhase}`);
            G.turnLog.push(`!%C${G.companyForAuction} for auction`);
            break;

        case PseudoPhase.NormalPlay:
            G.firstPlayerOfPhase = ctx.playOrder.indexOf(
                G.playerAfterPhase!.toString()
            );
            G.pseudoStage = PseudoStage.removeCube;
            G.anyActionsTaken = false;
            break;

        case PseudoPhase.Auction:
            G.passed = new Array(ctx.numPlayers).fill(false);
            G.currentBid = 0;
            G.winningBidder = 0;
            G.auctionFinished = false;
            G.firstPlayerOfPhase = G.playerInitialBidder!;
            break;
    }
}

function TurnNext(G: IEmuBayState, ctx: Ctx): string {
    // This should be removed when the boardgame.io phase bug is fixed
    if (G.firstTurnOfPhase) {
        return G.firstPlayerOfPhase!.toString();
    }

    let playOrderPos =
        ctx.playOrderPos >= 0
            ? ctx.playOrderPos
            : ctx.playOrder.findIndex((i) => i == ctx.currentPlayer.toString());

    switch (G.pseudoPhase) {
        case PseudoPhase.InitialAuction: {
            if (!G.auctionFinished) {
                let nextPlayerPos = (playOrderPos + 1) % ctx.numPlayers;
                while (G.passed![+ctx.playOrder[nextPlayerPos]]) {
                    nextPlayerPos = (nextPlayerPos + 1) % ctx.numPlayers;
                }
                return ctx.playOrder[nextPlayerPos].toString();
            } else {
                // For some reason, boardgame.io still runs this after phase change -
                // so go to the sensible thing that it will need next
                return G.playerAfterPhase!.toString();
            }
        }

        case PseudoPhase.NormalPlay:
            switch (G.pseudoStage) {
                case PseudoStage.buildingTrack:
                case PseudoStage.takeResources:
                    return ctx.playOrder[playOrderPos].toString();
                default:
                    return ctx.playOrder[
                        (playOrderPos + 1) % ctx.numPlayers
                    ].toString();
            }

        case PseudoPhase.Auction:
            if (!G.auctionFinished) {
                var nextPlayerPos = (playOrderPos + 1) % ctx.numPlayers;
                while (G.passed![+ctx.playOrder[nextPlayerPos]]) {
                    nextPlayerPos = (nextPlayerPos + 1) % ctx.numPlayers;
                }
                return ctx.playOrder[nextPlayerPos].toString();
            } else {
                // For some reason, boardgame.io still runs this after phase change -
                // so go to the sensible thing that it will need next
                return G.playerAfterPhase!.toString();
            }
    }
    // Should never hit
    throw Error(`Invalid TurnNext soft phase ${G.pseudoPhase}`);
}

export const EmuBayRailwayCompany = {
    name: GAME_ID,
    setup: (ctx: Ctx): IEmuBayState => {
        let companies = CompanyInitialState();
        let bondOrder = ctx.random?.Shuffle(startingBonds());
        bondOrder?.forEach((i, idx) => {
            companies[idx].bonds.push(i);
            companies[idx].cash = i.amount;
        });
        let track: ITrackBuilt[] = [];
        // Setting up resource cubes and homes
        let homeOrder = ctx.random?.Shuffle([
            CompanyID.GT,
            CompanyID.MLM,
            CompanyID.NED,
            CompanyID.NMF,
        ])!;
        let setupCardOrder = ctx.random?.Shuffle(SETUP_CARDS);
        let resourceCubes: ICoordinates[] = [];
        let resourceToAttemptToPlace: ICoordinates[] = [];
        setupCardOrder?.forEach((setupCard, idx) => {
            let O = SETUP_POINTS[idx];
            let buildPoints = [O].concat(getAdjacent(O));
            setupCard.forEach((space, idx) => {
                let buildCoord = buildPoints[idx];
                space.forEach((resource) => {
                    // Station
                    if (resource == 1) {
                        // Must be on mountain or forest to build resource
                        resourceToAttemptToPlace.push(buildCoord);
                    }
                    if (resource == 2) {
                        let co = homeOrder?.pop()!;
                        companies[co].home = buildCoord;
                    }
                });
            });
        });

        // Build track for each home station
        companies.forEach((co, idx) => {
            track.push({
                x: co.home!.x,
                y: co.home!.y,
                narrow: idx > 2,
                owner: idx <= 2 ? idx : undefined,
            });
        });

        MAP.forEach((terrain) => {
            if (!terrain.canPlaceResource) {
                return;
            }
            terrain.locations.forEach((xy) => {
                let toPlace = resourceToAttemptToPlace.filter(
                    (i) => i.x == xy.x && i.y == xy.y
                ).length;
                for (let i = 0; i < toPlace; ++i) {
                    resourceCubes.push(xy);
                }
            });
        });

        let G: IEmuBayState = {
            players: [...new Array(ctx.numPlayers)].map(
                (): IPlayer => ({
                    cash: Math.ceil(STARTING_CASH / ctx.numPlayers),
                })
            ),
            companies: companies,
            // Starting with take resources spaces filled and pay dividends filled
            actionCubeLocations: [
                false,
                false,
                false,
                false,
                false,
                true,
                true,
                true,
                false,
                false,
                true,
            ],
            resourceCubes: resourceCubes,
            // GT Excluded because in initial auction already
            independentOrder: [CompanyID.MLM, CompanyID.NED, CompanyID.NMF],
            track: track,
            bonds: initialAvailableBonds(),
            turnLog: [],
        };

        StartPhase(PseudoPhase.InitialAuction, G, ctx);

        return G;
    },

    turn: {
        order: {
            // This is way too hacky for me to be happy. Keeping first as actual
            // first was having bad effects on turn order (skipping any players in)
            // the order before it. Not sure if bug in my code or boardgame.io.
            first: (G: IEmuBayState, ctx: Ctx) =>
                ctx.turn == 0 ? G.firstPlayerOfPhase! : 0,
            next: () => 0,
        },
    },

    moves: {
        removeCube: (G: IEmuBayState, ctx: Ctx, action: actions) => {
            if (G.pseudoStage != PseudoStage.removeCube) {
                return INVALID_MOVE;
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            let filledSpaces = ACTION_CUBE_LOCATION_ACTIONS.map((v, i) => ({
                value: v,
                idx: i,
            }))
                .filter((v) => v.value == action)
                .filter((v) => G.actionCubeLocations[v.idx] == true);
            let filledSpaceCount = filledSpaces.length;
            if (filledSpaceCount == 0) {
                console.log("No cube to remove");
                return INVALID_MOVE;
            }

            G.turnLog.push(
                `%P${ctx.currentPlayer} removes cube from %A${action}`
            );

            // Remove a cube to place
            G.actionCubeTakenFrom = action;
            G.actionCubeLocations[filledSpaces[0].idx] = false;
            G.pseudoStage = PseudoStage.takeAction;
        },

        declareStalemate: (G: IEmuBayState, ctx: Ctx) => {
            if (stalemateAvailable(G, ctx)) {
                G.turnLog.push(`%P${ctx.currentPlayer} declares stalemate`);
                ctx.events!.endGame!(
                    getEndgameState(G, [EndGameReason.stalemate])
                );
            }
            var availableSpaces = ACTION_CUBE_LOCATION_ACTIONS.map((v, i) => ({
                value: v,
                idx: i,
            })).filter((v) => G.actionCubeLocations[v.idx] == false);
        },

        buildTrackAction: (G: IEmuBayState, ctx: Ctx, company: number) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.BuildTrack) == INVALID_MOVE) {
                return INVALID_MOVE;
            }
            G.turnLog.push(
                `%P${ctx.currentPlayer} starts building track for %C${company}`
            );
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.toAct = company;
            G.buildsRemaining = 3;
            G.anyActionsTaken = false;
            let playOrderPos =
                ctx.playOrderPos >= 0
                    ? ctx.playOrderPos
                    : ctx.playOrder.findIndex(
                          (i) => i == ctx.currentPlayer.toString()
                      );
            G.playerAfterPhase = (playOrderPos + 1) % ctx.numPlayers;
            G.pseudoStage = PseudoStage.buildingTrack;
        },

        mineResource: (G: IEmuBayState, ctx: Ctx, company: number) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.TakeResources) == INVALID_MOVE) {
                return INVALID_MOVE;
            }
            G.turnLog.push(
                `%P${ctx.currentPlayer} starts taking resources for %C${company}`
            );
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.toAct = company;
            G.mineLocation = null;
            let playOrderPos =
                ctx.playOrderPos >= 0
                    ? ctx.playOrderPos
                    : ctx.playOrder.findIndex(
                          (i) => i == ctx.currentPlayer.toString()
                      );
            G.playerAfterPhase = (playOrderPos + 1) % ctx.numPlayers;
            G.pseudoStage = PseudoStage.takeResources;
        },

        auctionShare: (G: IEmuBayState, ctx: Ctx, company: number) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.AuctionShare) == INVALID_MOVE) {
                return INVALID_MOVE;
            }
            // Hack due to weirdness
            let playOrderPos =
                ctx.playOrderPos >= 0
                    ? ctx.playOrderPos
                    : ctx.playOrder.findIndex(
                          (i) => i == ctx.currentPlayer.toString()
                      );
            G.playerAfterPhase = (playOrderPos + 1) % ctx.numPlayers;
            G.companyForAuction = company;
            if (
                G.players[+ctx.currentPlayer].cash < getMinimumBid(G, company)
            ) {
                console.log("Player must be able to pay minimum bid");
                return INVALID_MOVE;
            }
            if (G.companies[company].sharesRemaining <= 0) {
                console.log("No shares remaining");
                return INVALID_MOVE;
            }
            // Check that it's the next independent available if it's independent
            if (G.companies[company].companyType == CompanyType.Minor) {
                if (
                    G.independentOrder.length == 0 ||
                    company != G.independentOrder[0]
                ) {
                    console.log("Independent not available");
                    return INVALID_MOVE;
                }
            }

            G.firstTurnOfPhase = false; // Remove after phase bug fixed

            G.turnLog.push(
                `%P${ctx.currentPlayer} starts an auction for %C${company}`
            );

            G.playerInitialBidder = +ctx.currentPlayer;

            StartPhase(PseudoPhase.Auction, G, ctx);
        },

        issueBond: (
            G: IEmuBayState,
            ctx: Ctx,
            company: number,
            bond: number
        ) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.IssueBond) == INVALID_MOVE) {
                return INVALID_MOVE;
            }

            let bondString = `₤${G.bonds[bond].amount!} (₤${
                G.bonds[bond].baseInterest
            }Δ₤${G.bonds[bond].interestDelta}/div)`;
            G.turnLog.push(
                `%P${ctx.currentPlayer} issues a bond for %C${company} for ${bondString}`
            );

            G.companies[company].bonds.push(G.bonds[bond]);
            G.companies[company].cash += G.bonds[bond].amount;
            G.bonds.splice(bond, 1);
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.pseudoStage = PseudoStage.removeCube;
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },

        merge: (G: IEmuBayState, ctx: Ctx, major: number, minor: number) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.Merge) == INVALID_MOVE) {
                return INVALID_MOVE;
            }

            if (
                getMergableCompanies(G, ctx).find(
                    (i) => i.major == major && i.minor == minor
                ) == undefined
            ) {
                console.log("Merge is invalid");
                return INVALID_MOVE;
            }

            G.turnLog.push(
                `%P${ctx.currentPlayer} merges %C${major} and %C${minor}`
            );

            // Exchange shares
            G.companies[major].sharesHeld.push(
                G.companies[minor].sharesHeld[0]
            );
            G.companies[minor].sharesHeld = [];
            if (G.companies[major].reservedSharesRemaining > 0) {
                G.companies[major].reservedSharesRemaining -= 1;
            } else {
                G.companies[major].sharesRemaining -= 1;
                // Special rule for Emu Bay: When any other company is merged in,
                // EB reserved share becomes regular share
                G.companies[CompanyID.EB].sharesRemaining += 1;
                G.companies[CompanyID.EB].reservedSharesRemaining -= 1;
            }

            // Merge stuff in
            G.companies[major].bonds.push(...G.companies[minor].bonds);
            G.companies[major].cash += G.companies[minor].cash;
            G.companies[major].currentRevenue +=
                G.companies[minor].currentRevenue;
            G.companies[major].resourcesHeld +=
                G.companies[minor].resourcesHeld;
            G.companies[major].narrowGaugeRemaining +=
                G.companies[minor].narrowGaugeRemaining;
            G.companies[major].independentsOwned.push(G.companies[minor]);

            // Close minor
            G.companies[minor].open = false;
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.pseudoStage = PseudoStage.removeCube;
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },

        payDividends: (G: IEmuBayState, ctx: Ctx) => {
            if (G.pseudoStage != PseudoStage.takeAction) {
                return INVALID_MOVE;
            }
            if (jiggleCubes(G, actions.PayDividend) == INVALID_MOVE) {
                return INVALID_MOVE;
            }

            G.turnLog.push(`%P${ctx.currentPlayer} pays dividends`);

            // Pay dividends
            G.companies.forEach((co, idx) => {
                let amount =
                    co.currentRevenue > 0
                        ? Math.ceil(co.currentRevenue / co.sharesHeld.length)
                        : Math.floor(co.currentRevenue / co.sharesHeld.length);

                // Sometimes, maybe, I should split something like this
                if (co.open) {
                    G.turnLog.push(
                        `!%C${idx} pays ₤${amount} per share (${G.players
                            .map((_, p) => p)
                            .filter((p) => co.sharesHeld.some((p2) => p2 == p))
                            .map(
                                (p) =>
                                    `%P${p}: ₤${
                                        amount *
                                        co.sharesHeld.filter((p1) => p == p1)
                                            .length
                                    }`
                            )
                            .join(", ")})`
                    );
                }

                co.sharesHeld.forEach((n) => {
                    G.players[n].cash += amount;
                });

                // Adjust non-deferred debt
                let debtChange = co.bonds
                    .filter((i) => !i.deferred)
                    .reduce<number>((p, i) => i.interestDelta + p, 0);
                co.currentRevenue -= debtChange;
                console.log(co, " revenue reduced by ", debtChange);
                let totalDebtChange = debtChange;

                // Increase debt for each deferred
                co.bonds
                    .filter((i) => i.deferred)
                    .forEach((i) => {
                        co.currentRevenue -= i.baseInterest;
                        console.log(
                            co,
                            " revenue reduced by ",
                            i.baseInterest,
                            " following undefferal"
                        );
                        i.deferred = false;
                        totalDebtChange += i.baseInterest;
                    });

                if (totalDebtChange > 0) {
                    G.turnLog.push(
                        `!%C${idx} revenue reduced by ₤${totalDebtChange}`
                    );
                }
            });

            // Check for bankruptcy
            if (G.players.some((i) => i.cash < 0)) {
                ctx.events?.endGame!(
                    getEndgameState(G, [EndGameReason.bankruptcy])
                );
            }

            // Check for other end game conditions
            let reasons: EndGameReason[] = activeEndGameConditions(G);
            if (reasons.length >= 2) {
                ctx.events?.endGame!(getEndgameState(G, reasons));
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.pseudoStage = PseudoStage.removeCube;
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },

        buildTrack: (
            G: IEmuBayState,
            ctx: Ctx,
            xy: ICoordinates,
            buildMode: BuildMode
        ) => {
            // Must have track remaining
            if (G.pseudoStage != PseudoStage.buildingTrack) {
                return INVALID_MOVE;
            }
            if (buildMode == BuildMode.Normal) {
                if (G.companies[G.toAct!].trainsRemaining == 0) {
                    return INVALID_MOVE;
                }
            } else {
                if (G.companies[G.toAct!].narrowGaugeRemaining == 0) {
                    return INVALID_MOVE;
                }
            }

            // Must have build remaining
            if (G.buildsRemaining! <= 0) {
                return INVALID_MOVE;
            }

            // Must be in permitted space
            let allowed = getAllowedBuildSpaces(G, buildMode, G.toAct!);
            let thisSpace = allowed.find((i) => i.x == xy.x && i.y == xy.y);
            if (!thisSpace) {
                return INVALID_MOVE;
            }

            if (G.companies[G.toAct!].cash < thisSpace.cost) {
                return INVALID_MOVE;
            }

            let cost = thisSpace.cost;
            G.companies[G.toAct!].cash -= cost;
            let rev = thisSpace.rev;
            G.companies[G.toAct!].currentRevenue += rev;

            G.track.push({
                x: xy.x,
                y: xy.y,
                narrow: buildMode == BuildMode.Narrow,
                owner: buildMode == BuildMode.Normal ? G.toAct! : undefined,
            });
            if (buildMode == BuildMode.Normal) {
                G.companies[G.toAct!].trainsRemaining -= 1;
            } else {
                G.companies[G.toAct!].narrowGaugeRemaining -= 1;
            }
            G.anyActionsTaken = true;
            G.buildsRemaining! -= 1;

            G.turnLog.push(
                `%P${ctx.currentPlayer} builds track for %C${G.toAct} at (${xy.x}, ${xy.y}) costing ₤${cost} increasing revenue by ₤${rev}`
            );
        },

        doneBuilding: (G: IEmuBayState, ctx: Ctx) => {
            if (G.pseudoStage != PseudoStage.buildingTrack) {
                return INVALID_MOVE;
            }
            if (!G.anyActionsTaken) {
                console.log("No track built - can't pass");
                return INVALID_MOVE;
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            StartPhase(PseudoPhase.NormalPlay, G, ctx);
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },

        takeResource: (G: IEmuBayState, ctx: Ctx, xy: ICoordinates) => {
            if (G.pseudoStage != PseudoStage.takeResources) {
                return INVALID_MOVE;
            }
            if (
                !getTakeResourceSpaces(G, G.toAct!).find(
                    (i) => i.x == xy.x && i.y == xy.y
                )
            ) {
                console.log("Can't take from location");
                return INVALID_MOVE;
            }

            // Remove resource cube from space
            G.resourceCubes.splice(
                G.resourceCubes.findIndex((i) => i.x == xy.x && i.y == xy.y),
                1
            );

            G.mineLocation = xy;

            // Pay to remove resource cube
            let co = G.companies[G.toAct!];
            let cost = resourceCubeCost(G);
            co.cash -= cost;

            // Increase revenue
            let rev = resourceCubeRevenue(G, G.toAct!);
            co.currentRevenue += rev;

            G.turnLog.push(
                `%P${ctx.currentPlayer} takes resources for %C${G.toAct} at (${xy.x}, ${xy.y}) costing ₤${cost} increasing revenue by ₤${rev}`
            );

            co.resourcesHeld += 1;

            G.anyActionsTaken = true;
        },

        doneTaking: (G: IEmuBayState, ctx: Ctx) => {
            if (G.pseudoStage != PseudoStage.takeResources) {
                return INVALID_MOVE;
            }
            if (!G.anyActionsTaken) {
                console.log("No resources taken - can't pass");
                return INVALID_MOVE;
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.mineLocation = null;
            StartPhase(PseudoPhase.NormalPlay, G, ctx);
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },

        makeBid: (G: IEmuBayState, ctx: Ctx, amount: number) => {
            if (
                G.pseudoPhase != PseudoPhase.InitialAuction &&
                G.pseudoPhase != PseudoPhase.Auction
            ) {
                // Remove after phase bug fixed
                return INVALID_MOVE;
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed

            if (
                amount >= getMinimumBid(G, G.companyForAuction!) &&
                amount > G.currentBid!
            ) {
                G.winningBidder = +ctx.currentPlayer;
                G.currentBid = amount;
                G.turnLog.push(
                    `%P${ctx.currentPlayer} bids ₤${amount} for %C${G.companyForAuction}`
                );
                var biddersRemaining =
                    ctx.numPlayers - G.passed!.filter((i) => i).length;
                if (biddersRemaining == 1) {
                    if (G.pseudoPhase == PseudoPhase.InitialAuction) {
                        initialAuctionCompanyWon(G, ctx);
                    } else {
                        auctionCompanyWon(G, ctx);
                    }
                }
                ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
            } else {
                return INVALID_MOVE;
            }
        },

        pass: (G: IEmuBayState, ctx: Ctx) => {
            if (
                G.pseudoPhase != PseudoPhase.InitialAuction &&
                G.pseudoPhase != PseudoPhase.Auction
            ) {
                // Remove after phase bug fixed
                return INVALID_MOVE;
            }
            G.firstTurnOfPhase = false; // Remove after phase bug fixed
            G.turnLog.push(
                `%P${ctx.currentPlayer} passes on %C${G.companyForAuction}`
            );
            if (G.pseudoPhase == PseudoPhase.Auction) {
                if (
                    G.currentBid == 0 &&
                    +ctx.currentPlayer == G.playerInitialBidder
                ) {
                    // First player must bid, in auction that's not initial
                    return INVALID_MOVE;
                }
            }

            G.passed![+ctx.currentPlayer] = true;
            var biddersRemaining =
                ctx.numPlayers - G.passed!.filter((i) => i).length;
            if (biddersRemaining <= 1) {
                if (G.currentBid != 0 || biddersRemaining == 0) {
                    // All other players passed and bid made, or all players passed
                    if (G.pseudoPhase == PseudoPhase.InitialAuction) {
                        initialAuctionCompanyWon(G, ctx);
                    } else {
                        auctionCompanyWon(G, ctx);
                    }
                }
            }
            ctx.events?.endTurn!({ next: TurnNext(G, ctx) });
        },
    },
};
