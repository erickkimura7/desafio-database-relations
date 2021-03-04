import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Cliente nao encontrado')
    }

    const existentProducts = await this.productsRepository.findAllById(products);

    if (!existentProducts.length) {
      throw new AppError('Nenhum produto foi encontrado')
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const check = products.filter(
      product => !existentProductsIds.includes(product.id)
    )

    const produtosEncontrados = products.filter(
      product => existentProductsIds.includes(product.id)
    )

    if (check.length) {
      throw new AppError(`Produto não econtrado ${check[0].id}`)
    }

    // validar quantidade de products - existentProductsIds
    const produtosSemQuantidade = existentProducts.filter(produtoEncontrado => {
      const produto = products.find(prod => prod.id === produtoEncontrado.id);

      if (!produto) {
        return true;
      }
      console.log(`produto quantidade ${produto.quantity} - ${produtoEncontrado.quantity}`)
      return produto.quantity > produtoEncontrado.quantity;
    });

    if (produtosSemQuantidade.length) {
      throw new AppError(`Produto não tem quantidade disponivel ${produtosSemQuantidade[0].id}`)
    }

    const serilizeProduct = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serilizeProduct
    });

    const { order_products } = order;

    const ordQuant = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(p => p.id === product.product_id)[0].quantity - product.quantity
    }))

    await this.productsRepository.updateQuantity(ordQuant);

    return order;
  }
}

export default CreateOrderService;
