import { MatDialog } from '@angular/material/dialog';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, map, startWith } from 'rxjs';
import { Item, Producto, Proveedor, StockService } from 'src/app/stock.service';
import jsQR from 'jsqr';
import { RemitoQrReaderDialogComponent } from '../remito-qr-reader-dialog/remito-qr-reader-dialog.component';
import { RemitoAlCliente } from 'src/app/proveedor.service';

@Component({
  selector: 'app-alta-remito-form',
  templateUrl: './alta-remito-form.component.html',
  styleUrls: ['./alta-remito-form.component.css'],
})
export class AltaRemitoFormComponent implements OnInit, AfterViewInit {
  title = 'qr-reader';
  public cameras: MediaDeviceInfo[] = [];
  public myDevice!: MediaDeviceInfo;
  public scannerEnabled = false;
  public results: string[] = [];
  options: string[] = ['One', 'Two', 'Three'];
  _proveedores: Proveedor[] = [];
  proveedores$: Observable<Proveedor[]>;
  proveedoresFiltrados!: Observable<Proveedor[]>;
  productos$: Observable<Producto[]>;
  _productos: Producto[] = [];
  productosFiltrados!: Observable<Producto[]>;
  productoSeleccionado!: Producto | null;
  unidades: string[] = ['Kg', 'Ltr', 'U', 'Mts'];
  itemsCargados: Item[] = [];
  loading: boolean = false;
  remitoQRProveedor$!: Observable<RemitoAlCliente>;
  remitoQRProveedor!: RemitoAlCliente;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  constructor(
    private fb: FormBuilder,
    private stockService: StockService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.proveedores$ = this.stockService.proveedores$;
    this.productos$ = this.stockService.productos$;
    this.remitoQRProveedor$ = this.stockService.remitoQRProveedor$;
  }

  form = this.fb.group({
    proveedor: ['', Validators.required],
    fecha: ['', Validators.required],
    cuitProveedor: ['', Validators.required],
    telefono: ['', Validators.required],
    cantidad: ['', Validators.required],
    id: ['', Validators.required],
    unidad: ['', Validators.required],
    descripcion: ['', Validators.required],
  });

  displayedColumns: string[] = ['id', 'descripcion', 'cantidad', 'unidad'];
  dataSource = new MatTableDataSource<Item>();

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.data = [];
  }

  ngOnInit() {
    this.stockService.proveedores$.subscribe((proveedores) => {
      this._proveedores = proveedores;
    });

    this.stockService.productos$.subscribe((productos) => {
      this._productos = productos;
    });

    this.proveedoresFiltrados = this.form.controls.proveedor.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const lowerCase = value?.toLowerCase() || '';
        return this._proveedores.filter((option) =>
          option.nombre.toLowerCase().includes(lowerCase)
        );
      })
    );

    this.remitoQRProveedor$.subscribe((remito) => {
      if (remito) {
        this.remitoQRProveedor = remito;
        // proveedor: ['', Validators.required],
        // fecha: ['', Validators.required],
        // cuitProveedor: ['', Validators.required],
        // telefono: ['', Validators.required],
        const proveedor = this._proveedores.find(
          (p) => p.cuit === remito.cuitEmisor
        );
        if(proveedor){
          this.dataSource.data = [];
          const result = this._proveedores.find((p) => p.cuit === remito.cuitEmisor) || null;
          this.form.controls.cuitProveedor.setValue(result?.cuit || null);
          this.form.controls.telefono.setValue(result?.telefono || null);

          this.form.controls.proveedor.setValue((proveedor.id)?.toString() || null);
          const fecha = new Date(remito.fechaEmision).toDateString();
          this.form.controls.fecha.setValue(fecha || null);

          this.itemsCargados = remito.productos.map((p) => {
            return {
              // id: p.id,
              cantidad: p.item?.cantidad,
              unidad: p.item?.unidad,
              descripcion: p.descripcion,
            };
          });
          this.dataSource.data = this.itemsCargados;
        }
        // this.itemsCargados = remito.items;
        // this.dataSource.data = remito.items;
      }
    });

    this.productosFiltrados = this.form.controls.id.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const lowerCase = value?.toLowerCase() || '';
        const filtered = this._productos.filter((option) =>
          option.descripcion.toLowerCase().includes(lowerCase)
        );
        return filtered;
      })
    );

    this.dialog.afterAllClosed.subscribe(() => {
      this.snackBar.open('Remito leído correctamente', 'Cerrar', { duration: 3000 });
    });
  }

  productoSeleccionadoFn(event: any) {
    // this.form.controls.id.setValue(event.option.value.id);
    const productId = event.option.value;
    const result = this._productos.find((p) => p.id === productId) || null;
    this.productoSeleccionado = result ? result : null;
    this.form.controls.descripcion.setValue(
      this.productoSeleccionado?.descripcion || null
    );
  }

  proveedorSeleccionadoFn(event: any) {
    const proveedorId = event.option.value;
    const result = this._proveedores.find((p) => p.id === proveedorId) || null;
    this.form.controls.cuitProveedor.setValue(result?.cuit || null);
    this.form.controls.telefono.setValue(result?.telefono || null);
  }

  displayFnProd(i: Item): string {
    return i && i.descripcion ? i.descripcion : '';
  }

  addItem() {
    const items = this.dataSource.data;
    // Verify if fields are incompleted
    if (
      !this.form.controls.id?.value ||
      !this.form.controls.cantidad?.value ||
      !this.form.controls.descripcion?.value
    ) {
      this.snackBar.open('Debe completar todos los campos', 'Cerrar', {
        duration: 3000,
      });
      this.form.markAllAsTouched();
      return;
    }
    const item: Item = {
      id: Number(this.form.controls.id?.value),
      cantidad: Number(this.form.controls.cantidad?.value),
      unidad: this.form.controls.unidad?.value || '',
      descripcion: this.form.controls.descripcion?.value || '',
    };
    items.push(item);
    this.dataSource.data = items;
    this.itemsCargados = items;
    this.form.controls.id.setValue('');
    this.form.controls.id.setErrors(null);
    this.form.controls.cantidad.setValue('');
    this.form.controls.cantidad.setErrors(null);
    this.form.controls.unidad.setValue('');
    this.form.controls.unidad.setErrors(null);
    this.form.controls.descripcion.setValue('');
    this.form.controls.descripcion.setErrors(null);
    clearFieldAndErrors(['id', 'cantidad', 'unidad', 'descripcion'], this.form);
  }

  guardarRemito() {
    if (
      !this.form.controls.proveedor?.value ||
      !this.form.controls.fecha?.value ||
      !this.form.controls.cuitProveedor?.value ||
      !this.form.controls.telefono?.value
    ) {
      this.snackBar.open(
        'Debe completar todos los campos de la cabecera',
        'Cerrar',
        { duration: 3000 }
      );
      this.form.markAllAsTouched();
      return;
    }
    if (!this.itemsCargados.length) {
      this.snackBar.open('Debe cargar al menos un item', 'Cerrar', {
        duration: 3000,
      });
      return;
    }
    this.loading = true;
    const body = {
      proveedorId: this.form.controls.proveedor.value,
      fechaEmision: new Date(this.form?.controls?.fecha.value).toISOString(),
      items: this.itemsCargados.map((i) => {
        return {
          productoId: i.id,
          cantidad: i.cantidad,
          unidad: i.unidad,
        };
      }),
    };

    this.stockService.guardarRemito(body).subscribe(
      (res) => {
        this.snackBar.open('Remito guardado', 'Cerrar', { duration: 3000 });
        this.limpiarForm();
        this.loading = false;
        this.dataSource.data = [];
        this.itemsCargados = [];
        this.form.reset();
      },
      (err) => {
        this.loading = false;
        console.log(err);
        this.snackBar.open('Error al guardar remito', 'Cerrar', {
          duration: 3000,
        });
      }
    );
  }

  scanQR() {
    this.dialog.open(RemitoQrReaderDialogComponent, {
      width: '50vw',
      height: '35vw',
    });
  }

  limpiarForm() {
    this.form.reset();
  }
}

export const clearFieldAndErrors = (keys: string[], form: FormGroup) => {
  keys.forEach((key) => {
    form.controls[key].setValue('');
    form.controls[key].setErrors(null);
  });
};
