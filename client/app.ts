import { Client } from 'boardgame.io/client';
import { Ctx, State } from 'boardgame.io';
import { SocketIO } from 'boardgame.io/multiplayer';
import { CreateGameReducer } from 'boardgame.io/internal';
import { EmuBayRailwayCompany, IEmuBayState } from '../game/game';
import { Board } from './board';
import { Ui } from './ui';

import * as PIXI from 'pixi.js'

//localStorage.debug = '*';

interface IHistoricState { state: State<IEmuBayState>, automatic: boolean, ctx: Ctx };

export class EmuBayRailwayCompanyClient {
    private client: any;
    private rootElement: HTMLElement;
    constructor(rootElement: HTMLElement, mp?: boolean, playerID?: string | null, matchId?: string, numPlayers: number = 4) {
        this.rootElement = rootElement;
        if (!mp) {
            // Hotseat
            this.client = Client({ game: EmuBayRailwayCompany, numPlayers: numPlayers });
            this.client.start();
            continueLoading();
        } else {
            // Have to get a credential each time due to boardgame.io's 'authenticate' not playing super nicely with
            // the session storage
            let req = new XMLHttpRequest();
            req.open("get", "/get_credentials");
            req.onreadystatechange = () => {
                if (req.readyState == 4 && req.status == 200) {
                    let credentials = req.responseText;
                    if (playerID && playerID != "-1") {
                        this.client = Client({
                            game: EmuBayRailwayCompany,
                            multiplayer: SocketIO(),
                            matchID: matchId,
                            playerID: playerID,
                            credentials: credentials
                        });
                    } else {
                        // Observer only
                        this.client = Client({
                            game: EmuBayRailwayCompany,
                            multiplayer: SocketIO(),
                            matchID: matchId,
                            playerID: "-1"
                        });
                    }
                    this.client.start();
                    continueLoading();
                }
                else if (req.readyState == 4 && req.status != 200) {
                    document.body.innerHTML = `Failed to get credentials (${req.status}) - ${req.responseText}`;
                }
            }
            req.send();
        }
    }

    public pixiApp = new PIXI.Application({ backgroundColor: 0xEEEEFF, width: 1000, height: 1000 });

    private theUi: Ui | undefined;
    public mapState: Board | undefined;

    public startLoop(resources: { [index: string]: PIXI.LoaderResource }): void {
        this.mapState = new Board(this.pixiApp, resources);
        this.theUi = new Ui(this);
        this.mapState.start();
        // Subscribe in this order, as UI may change things the board needs
        this.client.subscribe((state: State) => {
            this.newestState = state;
            if (this.atCurrent) {
                this.SkipToCurrent();
            }
        });
    }

    public SkipToCurrent() {
        let wasAtCurrent = this.atCurrent;
        this.atCurrent = true;
        if (this.newestState === null) return;
        this!.theUi!.update(this.newestState.G as IEmuBayState, this.newestState.ctx, this.client, this?.mapState!, this.atCurrent, this.visibleTurnId)
        this!.mapState!.drawMap(this.newestState.G as IEmuBayState, this.newestState.ctx);
        this!.visibleTurnId = this.client.log.length - 1;
        this.theUi!.UpdateLog(this.client.log.length - 1, this.newestState.G as IEmuBayState)
    }

    public StepForward() {
        let allStates = this.GetStateHistory();
        let nextTurn = this.visibleTurnId;
        do {
            ++nextTurn;
        } while ((nextTurn < allStates.length) && allStates[nextTurn].automatic)
        this.ReviewTurn(allStates, nextTurn);
    }

    public StepBack() {
        let allStates = this.GetStateHistory();
        let nextTurn = this.visibleTurnId;
        do {
            --nextTurn;
        } while ((nextTurn > 0) && allStates[nextTurn].automatic)
        this.ReviewTurn(allStates, nextTurn);
    }

    public JumpToStart() {
        let allStates = this.GetStateHistory();
        this.ReviewTurn(allStates, 0);
    }

    private ReviewTurn(stateHistory: IHistoricState[], turnNumber: number) {
        // This may need caching in the future - because replays whole game each back or forward
        let currentTurnId = this.client.log.length - 1;
        this.visibleTurnId = Math.max(0, Math.min(turnNumber, currentTurnId));
        // The last turn could be automatic - hence, current might not be strictly true when expected
        this.atCurrent = (this.visibleTurnId == currentTurnId) || stateHistory.slice(this.visibleTurnId + 1).every(i=>i.automatic);

        let {state, ctx} = stateHistory[this.visibleTurnId];
        // Get the state at this point

        this!.theUi!.update(state.G as IEmuBayState, ctx, this.client, this?.mapState!, this.atCurrent, this.visibleTurnId)
        this!.mapState!.drawMap(state.G as IEmuBayState, ctx);

        this.theUi!.UpdateLog(this.visibleTurnId, state.G as IEmuBayState);
    }

    private GetStateHistory(): IHistoricState[] {
        const reducer = CreateGameReducer({ game: EmuBayRailwayCompany, isClient: false });
        const stateSnapshots: IHistoricState[] = [];
        let state: State<IEmuBayState> = this.client.initialState;

        stateSnapshots.push({state: this.client.initialState, automatic: false, ctx: this.client.initialState.ctx});

        // TODO: Map these types out correctly
        this.client.log.forEach((i: any) => {
            const { action } = i;
            // ignore automatic log entries - in example code, but not including until known to be necessary
            state = reducer(state, action);
            stateSnapshots.push({ state: state, automatic: i?.action?.type != "MAKE_MOVE", ctx: state.ctx });
        });

        return stateSnapshots;
    }


    private newestState: State | null = null;

    private atCurrent: boolean = true;
    private visibleTurnId: number = 0;
}

const appElement: HTMLElement = document.getElementById('app')!;
const params = new URLSearchParams(window.location.search);
var app: EmuBayRailwayCompanyClient;
if (params.has("matchId")) {
    // Multiplayer
    if (params.has("playerId")) {
        app = new EmuBayRailwayCompanyClient(appElement, true, params.get('playerId')!, params.get("matchId")!);
    } else {
        // Observer mode
        app = new EmuBayRailwayCompanyClient(appElement, true, null, params.get("matchId")!);
    }
}
else {
    // Hotseat
    let playerCount = (params.has("playerCount")) ? Number(params.get('playerCount')) : 4;
    app = new EmuBayRailwayCompanyClient(appElement, false, undefined, undefined, playerCount);
}

function continueLoading() {
    const loader = PIXI.Loader.shared;
    Board.addResources(loader);


    loader.load((loader: PIXI.Loader, resources: Partial<Record<string, PIXI.LoaderResource>>) => {
        console.log("Resources loaded");
        Board.getTextures(loader.resources)
        app.startLoop(loader.resources);
        resize();
    })
}

document.querySelector("#board")?.appendChild(app.pixiApp.view)

window.onresize = resize;

function resize() {
    let boardDiv = document.querySelector("#boarditem")
    app!.mapState?.resizeToWidth(boardDiv?.clientWidth ?? 1000);
}