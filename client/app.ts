import { Client } from 'boardgame.io/client';
import { State } from 'boardgame.io';
import { SocketIO } from 'boardgame.io/multiplayer';
import { CreateGameReducer } from 'boardgame.io/internal';
import { EmuBayRailwayCompany, IEmuBayState } from '../game/game';
import { Board } from './board';
import { Ui } from './ui';

import * as PIXI from 'pixi.js'

//localStorage.debug = '*';

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
                    if (playerID && playerID != "-1")
                    {
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
    private mapState: Board | undefined;

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
        this.atCurrent = true;
        if (this.newestState === null) return;
        this!.theUi!.update(this.newestState.G as IEmuBayState, this.newestState.ctx, this.client, this?.mapState!, this.atCurrent, this.visibleTurnId)
        this!.mapState!.drawMap(this.newestState.G as IEmuBayState, this.newestState.ctx);
        this!.visibleTurnId = this.client.log.length - 1;
    }

    public StepForward() {
        this.ReviewTurn(this.visibleTurnId + 1);
    }

    public StepBack() {
        this.ReviewTurn(this.visibleTurnId - 1);
    }

    public JumpToStart() {
        this.ReviewTurn(0);
    }

    private ReviewTurn(turnNumber: number) {
        // This may need caching in the future - because replays whole game each back or forward
        let currentTurnId = this.client.log.length - 1;
        this.visibleTurnId = Math.max(0, Math.min(turnNumber, currentTurnId));
        this.atCurrent = this.visibleTurnId == currentTurnId;

        const reducer = CreateGameReducer({ game: EmuBayRailwayCompany });
        const stateSnapshots = [];
        let state = this.client.initialState;
      
        for (let i = 0; i < this.visibleTurnId; i++) {
          const { action, automatic } = this.client.log[i];
          // ignore automatic log entries - in example code, but not including until known to be necessary
          if (automatic) continue;
          state = reducer(state, action);
          stateSnapshots.push(state);
        }
        // Get the state at this point

        this!.theUi!.update(state.G as IEmuBayState, state.ctx, this.client, this?.mapState!, this.atCurrent, this.visibleTurnId)
        this!.mapState!.drawMap(state.G as IEmuBayState, state.ctx);
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
    })
}

document.querySelector("#board")?.appendChild(app.pixiApp.view)